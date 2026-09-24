export function formatUserName(value) {
    const login = (value || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
    if (!login) return 'Autor não informado';
    return login.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export async function recordAudit(supabase, { userId, performedBy, action, entityType, entityId, details }) {
    if (!supabase) return { error: null };
    const { error } = await supabase.from('audit_logs').insert({
        user_id: userId || null,
        performed_by: performedBy || 'Autor não informado',
        action,
        entity_type: entityType,
        entity_id: entityId == null ? null : String(entityId),
        details: details || null
    });
    return { error };
}

export async function loadCloudDataFromSupabase(supabase, fallbackProducts = []) {
    const [{ data: products, error: productsError }, { data: movements, error: movementsError }, { data: balanceMovements, error: balanceMovementsError }, { data: orders, error: ordersError }, { data: auditLogs, error: auditLogsError }, { data: contracts, error: contractsError }] = await Promise.all([
        supabase.from('products').select('*, categories(name), suppliers(name)').eq('active', true).order('name'),
        supabase.from('stock_movements').select('*, products(name, suppliers(name))').order('created_at', { ascending: false }),
        supabase.from('balance_movements').select('*, products(name, suppliers(name))').order('created_at', { ascending: false }),
        supabase.from('orders').select('*, products(name), suppliers(name), receipts(*)').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('balance_contracts').select('*, products(name, unit, suppliers(name)), suppliers(name)').order('created_at', { ascending: false })
    ]);
    if (productsError) return { error: `Produtos: ${productsError.message}` };

    const normalizedProducts = uniqueProducts((products || []).map(product => ({ ...product, category: product.categories?.name || 'Sem categoria', supplier: product.suppliers?.name || 'Sem fornecedor', minStock: Number(product.min_stock || 0), stock: Number(product.stock || 0), unit: product.unit || 'un' })));
    const knownNames = new Set(normalizedProducts.map(productKey));
    const nextId = normalizedProducts.reduce((max, product) => Math.max(max, Number(product.id) || 0), 0) + 1;
    const missingCatalogProducts = fallbackProducts
        .filter(product => !knownNames.has(productKey(product)))
        .map((product, index) => ({ ...product, id: nextId + index }));
    const effectiveProducts = uniqueProducts([...normalizedProducts, ...missingCatalogProducts]);

    const failedReports = [
        movementsError && 'movimentações',
        balanceMovementsError && 'lançamentos de saldo',
        ordersError && 'empenhos e recebimentos',
        auditLogsError && 'atividade do sistema',
        contractsError && 'controle de saldo'
    ].filter(Boolean);
    return {
        warning: failedReports.length ? `Não foi possível carregar: ${failedReports.join(', ')}. ${['42P01', 'PGRST205'].includes(auditLogsError?.code) ? 'Execute o supabase-schema.sql atualizado para criar a tabela de auditoria.' : 'Verifique as tabelas e as políticas RLS no Supabase.'}` : null,
        data: {
            products: effectiveProducts,
            movements: movementsError ? [] : await Promise.all((movements || []).map(async movement => ({ id: movement.id, productId: movement.product_id, date: movement.movement_date, time: new Date(movement.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), product: movement.products?.name || 'Produto removido', type: movement.type, quantity: Number(movement.quantity), delta: Number(movement.new_stock || 0) - Number(movement.previous_stock || 0), user: formatUserName(movement.performed_by), note: movement.note || '', supplier: movement.products?.suppliers?.name || '', unitValue: Number(movement.unit_price || 0), totalValue: Number(movement.quantity || 0) * Number(movement.unit_price || 0), document: movement.document_number || '', attachmentPath: movement.attachment_path || '', attachmentName: movement.attachment_name || '', attachmentUrl: movement.attachment_path ? (await supabase.storage.from('movement-attachments').createSignedUrl(movement.attachment_path, 3600)).data?.signedUrl || '' : '' })) ),
            balanceMovements: balanceMovementsError ? [] : (balanceMovements || []).map(movement => ({ id: movement.id, productId: movement.product_id, date: movement.movement_date, time: new Date(movement.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), product: movement.products?.name || 'Produto removido', type: movement.type, quantity: Number(movement.quantity), user: formatUserName(movement.performed_by), note: movement.note || '', supplier: movement.products?.suppliers?.name || '', unitValue: Number(movement.unit_price || 0), totalValue: Number(movement.quantity || 0) * Number(movement.unit_price || 0), document: movement.document_number || '' })),
            orders: ordersError ? [] : (orders || []).map(order => ({ product: order.products?.name || 'Produto não identificado', ordered: Number(order.ordered_quantity || 0), receipts: (order.receipts || []).map(receipt => [receipt.receipt_date, Number(receipt.quantity || 0)]) })),
            auditLogs: auditLogsError ? [] : (auditLogs || []).map(log => ({ id: log.id, date: log.created_at?.slice(0, 10), time: log.created_at ? new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '', user: formatUserName(log.performed_by), action: log.action, entityType: log.entity_type, entityId: log.entity_id, details: log.details || '' })),
            contracts: contractsError ? [] : (contracts || []).map(contract => ({ id: contract.id, productId: contract.product_id, productName: contract.products?.name || '', supplier: contract.suppliers?.name || '', unit: contract.products?.unit || 'un', ordered: Number(contract.ordered_quantity || 0), unitValue: Number(contract.unit_price || 0), contractDate: contract.contract_date || '', note: contract.note || '' }))
        }
    };
}

function normalizeProductName(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function productKey(product) {
    return `${normalizeProductName(product.name)}::${normalizeProductName(product.supplier)}`;
}

function uniqueProducts(products = []) {
    const seen = new Set();
    return products.filter(product => {
        const key = productKey(product);
        if (!normalizeProductName(product.name) || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
