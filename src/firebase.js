import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, setDoc, where, writeBatch } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const MAX_ATTACHMENT_BYTES = 700 * 1024;

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(value =>
    typeof value === 'string' && value.trim() && !/^(preencha-aqui|your-|seu-|seu projeto)/i.test(value.trim())
);
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Transitional adapter: it keeps the existing screen/service contract while all persistence
// and authentication are performed by Firebase. New code should use Firebase SDK functions.
export const firebaseCompat = app ? createCompatClient() : null;

function createCompatClient() {
    const client = {
        auth: {
            onAuthStateChange(callback) {
                const unsubscribe = onAuthStateChanged(auth, user => callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null));
                return { data: { subscription: { unsubscribe } } };
            },
            async getSession() {
                const user = auth.currentUser;
                return { data: { session: user ? { user } : null }, error: null };
            },
            async signInWithPassword({ email, password }) {
                try {
                    const result = await signInWithEmailAndPassword(auth, email, password);
                    return { data: { user: result.user }, error: null };
                } catch (error) { return { data: null, error: asError(error) }; }
            },
            async signOut() {
                try { await signOut(auth); return { error: null }; }
                catch (error) { return { error: asError(error) }; }
            }
        },
        from(table) { return new QueryBuilder(table); },
        attachments: {
            from(bucket) { return createFirestoreAttachmentStore(bucket); }
        },
        rpc(name, args) { return callRpc(name, args); },
        channel() { return new RealtimeChannel(); },
        removeChannel(channel) { channel.unsubscribe(); return Promise.resolve('ok'); }
    };
    return client;
}

class QueryBuilder {
    constructor(table) {
        this.table = table;
        this.filters = [];
        this.sorts = [];
        this.selection = '*';
        this.operation = 'select';
        this.payload = null;
        this.returnRows = false;
        this.singleResult = false;
        this.allowEmpty = false;
    }
    select(fields = '*') { this.selection = fields; if (this.operation !== 'select') this.returnRows = true; return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    order(field, options = {}) { this.sorts.push([field, options.ascending !== false]); return this; }
    insert(rows) { this.operation = 'insert'; this.payload = rows; return this; }
    upsert(rows) { this.operation = 'upsert'; this.payload = rows; return this; }
    update(values) { this.operation = 'update'; this.payload = values; return this; }
    delete() { this.operation = 'delete'; return this; }
    single() { this.singleResult = true; return this; }
    maybeSingle() { this.singleResult = true; this.allowEmpty = true; return this; }
    then(resolve, reject) { return this.execute().then(resolve, reject); }

    async execute() {
        try {
            const rows = await this.perform();
            if (this.operation === 'delete' || (['insert', 'upsert', 'update'].includes(this.operation) && !this.returnRows)) return { data: null, error: null };
            if (!this.singleResult) return { data: rows, error: null };
            if (!rows.length && this.allowEmpty) return { data: null, error: null };
            if (rows.length !== 1) return { data: null, error: { message: rows.length ? 'Expected exactly one document.' : 'Document not found.', code: 'DOCUMENT_COUNT' } };
            return { data: rows[0], error: null };
        } catch (error) { return { data: null, error: asError(error) }; }
    }

    async perform() {
        if (this.operation === 'select') return this.readRows();
        if (this.operation === 'insert') return this.writeRows(false);
        if (this.operation === 'upsert') return this.writeRows(true);
        const snapshot = await getDocs(collection(db, this.table));
        const matches = snapshot.docs.map(item => ({ ...item.data(), id: item.data().id ?? item.id, _docId: item.id })).filter(row => this.matches(row));
        if (this.operation === 'delete') {
            const batch = writeBatch(db);
            matches.forEach(row => batch.delete(doc(db, this.table, row._docId)));
            await batch.commit();
            return [];
        }
        if (this.operation === 'update') {
            const batch = writeBatch(db);
            matches.forEach(row => batch.set(doc(db, this.table, row._docId), { ...this.payload, id: row.id }, { merge: true }));
            await batch.commit();
            return this.returnRows ? matches.map(row => ({ ...row, ...this.payload })) : [];
        }
        return [];
    }

    async writeRows(upsert) {
        const input = Array.isArray(this.payload) ? this.payload : [this.payload];
        const output = [];
        for (const value of input) {
            let id = value.id == null ? null : String(value.id);
            if (!upsert && this.table === 'products') {
                const existingProducts = await getDocs(query(collection(db, this.table), where('name', '==', value.name)));
                const duplicate = existingProducts.docs.some(item => item.data().supplier_id === value.supplier_id);
                if (duplicate) throw Object.assign(new Error('Já existe um produto com esse nome e fornecedor.'), { code: '23505' });
            }
            if (upsert && !id && value.name) {
                const existing = await getDocs(query(collection(db, this.table), where('name', '==', value.name)));
                if (!existing.empty) id = existing.docs[0].id;
            }
            if (!id && this.table === 'products') id = String(await allocateProductId());
            const reference = id ? doc(db, this.table, id) : doc(collection(db, this.table));
            const row = { ...value, id: value.id == null ? (this.table === 'products' ? Number(reference.id) : reference.id) : value.id };
            await setDoc(reference, row, { merge: upsert });
            if (this.returnRows) output.push(row);
        }
        return output;
    }

    async readRows() {
        const snapshot = await getDocs(collection(db, this.table));
        let rows = snapshot.docs.map(item => ({ ...item.data(), id: item.data().id ?? item.id, _docId: item.id })).filter(row => this.matches(row));
        for (const [field, ascending] of this.sorts) rows.sort((a, b) => compare(a[field], b[field]) * (ascending ? 1 : -1));
        rows = await Promise.all(rows.map(row => expandRelations(this.table, row, this.selection)));
        return rows;
    }

    matches(row) { return this.filters.every(([field, value]) => row[field] === value || String(row[field]) === String(value)); }
}

async function expandRelations(table, row, selection) {
    const output = { ...row };
    if (table === 'products') {
        output.categories = await related('categories', row.category_id);
        output.suppliers = await related('suppliers', row.supplier_id);
    } else if (table === 'stock_movements' || table === 'balance_movements') {
        output.products = await related('products', row.product_id);
        if (output.products) output.products.suppliers = await related('suppliers', output.products.supplier_id);
    } else if (table === 'orders') {
        output.products = await related('products', row.product_id);
        output.suppliers = await related('suppliers', row.supplier_id);
        const receiptSnapshot = await getDocs(query(collection(db, 'receipts'), where('order_id', '==', row.id)));
        output.receipts = receiptSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    } else if (table === 'balance_contracts') {
        output.products = await related('products', row.product_id);
        if (output.products) output.products.suppliers = await related('suppliers', output.products.supplier_id);
        output.suppliers = await related('suppliers', row.supplier_id);
    }
    return output;
}

async function related(table, id) {
    if (id == null) return null;
    if (table === 'products') {
        const result = await getDoc(doc(db, table, String(id)));
        return result.exists() ? { id: result.data().id ?? Number(result.id), ...result.data() } : null;
    }
    const result = await getDoc(doc(db, table, String(id)));
    return result.exists() ? { id: result.data().id ?? result.id, ...result.data() } : null;
}

async function allocateProductId() {
    const counterRef = doc(db, 'system', 'product-counter');
    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(counterRef);
        const nextId = Math.max(Number(snapshot.data()?.value || 10000) + 1, 10001);
        transaction.set(counterRef, { value: nextId }, { merge: true });
        return nextId;
    });
}

function createFirestoreAttachmentStore(bucket) {
    return {
        async upload(path, file, options = {}) {
            try {
                const contentType = options.contentType || file.type || 'application/octet-stream';
                if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('O arquivo excede o limite gratuito de 700 KiB por anexo. Reduza o tamanho do PDF ou da imagem e tente novamente.');
                if (!/^application\/pdf$|^image\//i.test(contentType)) throw new Error('Anexe somente arquivos PDF ou imagens.');
                const fileData = await fileToDataUrl(file, contentType);
                const attachmentId = encodeURIComponent(`${bucket}/${path}`);
                await setDoc(doc(db, 'movement_attachments', attachmentId), {
                    path, bucket, fileData, content_type: contentType, size: file.size,
                    name: file.name || path.split('/').pop(), updated_at: new Date().toISOString()
                });
                return { data: { path }, error: null };
            } catch (error) { return { data: null, error: asError(error) }; }
        },
        async createSignedUrl(path) {
            try {
                const attachmentId = encodeURIComponent(`${bucket}/${path}`);
                const snapshot = await getDoc(doc(db, 'movement_attachments', attachmentId));
                if (!snapshot.exists()) throw new Error('Anexo não encontrado no Firestore.');
                return { data: { signedUrl: snapshot.data().fileData }, error: null };
            } catch (error) { return { data: null, error: asError(error) }; }
        },
        async remove(paths) {
            try {
                const batch = writeBatch(db);
                paths.forEach(path => batch.delete(doc(db, 'movement_attachments', encodeURIComponent(`${bucket}/${path}`))));
                await batch.commit();
                return { data: null, error: null };
            } catch (error) { return { data: null, error: asError(error) }; }
        }
    };
}

async function fileToDataUrl(file, contentType) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
}

async function callRpc(name, args) {
    if (name !== 'register_stock_movement') return { data: null, error: { message: `Operação Firebase desconhecida: ${name}`, code: 'UNSUPPORTED_OPERATION' } };
    try {
        const productRef = doc(db, 'products', String(args.p_product_id));
        const movementRef = doc(db, 'stock_movements', String(args.p_movement_id));
        const result = await runTransaction(db, async transaction => {
            const productSnapshot = await transaction.get(productRef);
            if (!productSnapshot.exists()) throw new Error('Produto não encontrado no Firestore.');
            const product = productSnapshot.data();
            const previousStock = Number(product.stock || 0);
            const quantity = Number(args.p_quantity || 0);
            if (args.p_type === 'saida' && quantity > previousStock) {
                throw new Error(`Quantidade indisponível. O saldo atual deste produto é de ${previousStock}.`);
            }
            const delta = args.p_type === 'entrada' ? quantity : args.p_type === 'saida' ? -quantity : quantity - previousStock;
            const newStock = Math.max(0, previousStock + delta);
            transaction.update(productRef, { stock: newStock, updated_at: new Date().toISOString() });
            transaction.set(movementRef, {
                id: args.p_movement_id, product_id: args.p_product_id, type: args.p_type, quantity,
                previous_stock: previousStock, new_stock: newStock, movement_date: args.p_movement_date,
                note: args.p_note || '', unit_price: Number(args.p_unit_price || 0),
                document_number: args.p_document_number || '', user_id: args.p_user_id || null,
                performed_by: args.p_performed_by || 'Autor não informado', created_at: new Date().toISOString()
            });
            return { previous_stock: previousStock, new_stock: newStock };
        });
        return { data: [result], error: null };
    } catch (error) { return { data: null, error: asError(error) }; }
}

class RealtimeChannel {
    constructor() { this.tables = new Set(); this.unsubscribers = []; }
    on(_event, filter, callback) { if (filter?.table) this.tables.add(filter.table); this.callback = callback; return this; }
    subscribe() {
        this.tables.forEach(table => this.unsubscribers.push(onSnapshot(collection(db, table), () => this.callback?.())));
        return this;
    }
    unsubscribe() { this.unsubscribers.forEach(unsubscribe => unsubscribe()); this.unsubscribers = []; }
}

function compare(left, right) {
    if (left == null) return right == null ? 0 : -1;
    if (right == null) return 1;
    return typeof left === 'string' ? left.localeCompare(String(right)) : Number(left) - Number(right);
}

function asError(error) { return { message: error?.message || 'Erro inesperado ao acessar o Firebase.', code: error?.code || 'FIREBASE_ERROR' }; }
