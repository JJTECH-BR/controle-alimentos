export async function persistMovement({ firebase, product, form, userId, performedBy }) {
    if (firebase) {
        const syncedProduct = await ensureProductInFirebase(firebase, product);
        if (syncedProduct.error) return { error: syncedProduct.error };
        product = { ...product, ...syncedProduct.product, supplier: syncedProduct.product.suppliers?.name || product.supplier };
    }
    const quantity = Number(form.quantity);
    const currentStock = Number(product.stock || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Informe uma quantidade válida.' };
    if (form.type === 'saida' && quantity > currentStock) return { error: `Quantidade indisponível. O saldo atual deste produto é de ${currentStock} ${product.unit || ''}.` };

    const delta = form.type === 'entrada' ? quantity : form.type === 'saida' ? -quantity : quantity - currentStock;
    const nextStock = Math.max(0, currentStock + delta);
    const movement = {
        id: crypto.randomUUID(),
        date: form.date || new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        product: product.name,
        type: form.type,
        quantity,
        delta,
        user: performedBy || 'Autor não informado',
        note: form.note || '',
        supplier: form.supplier || product.supplier,
        productId: product.id,
        unitValue: Number(form.unitValue || 0),
        totalValue: Number(form.totalValue || 0),
        document: form.document || '',
        attachment: form.attachment ? { name: form.attachment.name, type: form.attachment.type, size: form.attachment.size } : null
    };

    if (firebase) {
        if (form.attachment instanceof File) {
            const uploaded = await uploadAttachment(firebase, movement.id, form.attachment);
            if (uploaded.error) return { error: uploaded.error };
            movement.attachmentPath = uploaded.path;
            movement.attachmentUrl = uploaded.url;
        }
        const { data, error } = await firebase.rpc('register_stock_movement', {
            p_movement_id: movement.id,
            p_product_id: product.id,
            p_type: form.type,
            p_quantity: quantity,
            p_movement_date: movement.date,
            p_note: movement.note,
            p_unit_price: movement.unitValue,
            p_document_number: movement.document,
            p_user_id: userId || null,
            p_performed_by: performedBy || 'Autor não informado'
        });
        if (error && !isMissingMovementFunction(error)) {
            if (movement.attachmentPath) await firebase.attachments.from('movement-attachments').remove([movement.attachmentPath]);
            return { error: error.message };
        }
        if (error) return persistMovementDirectly(firebase, movement, product, nextStock, userId, performedBy);
        const result = Array.isArray(data) ? data[0] : data;
        if (!result) return { error: 'O Firebase não retornou o resultado da movimentação.' };
        if (movement.attachmentPath) {
            const { error: attachmentError } = await firebase.from('stock_movements').update({ attachment_path: movement.attachmentPath, attachment_name: movement.attachment.name }).eq('id', movement.id);
            if (attachmentError) {
                const metadataMissing = /attachment_(path|name)|schema cache|column .* does not exist/i.test(attachmentError.message || '');
                if (!metadataMissing) return { error: `Movimentação salva, mas o anexo não pôde ser vinculado: ${attachmentError.message}` };
                movement.attachmentWarning = `Movimentação salva, mas o anexo não pôde ser vinculado: ${attachmentError.message}`;
            }
        }
        movement.delta = Number(result.new_stock) - Number(result.previous_stock);
        return { movement, nextStock: Number(result.new_stock) };
    }

    return { movement, nextStock };
}

async function uploadAttachment(firebase, movementId, file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const path = `${movementId}/${safeName}`;
    const { error } = await firebase.attachments.from('movement-attachments').upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: `Não foi possível salvar o anexo no Firestore: ${error.message}` };
    const { data } = await firebase.attachments.from('movement-attachments').createSignedUrl(path);
    return { path, url: data?.signedUrl || '' };
}

export async function deleteMovementAttachment(firebase, movement) {
    if (!movement.attachmentPath) return { error: 'Este registro não possui um anexo salvo.' };
    const { error: storageError } = await firebase.attachments.from('movement-attachments').remove([movement.attachmentPath]);
    if (storageError) return { error: `Não foi possível excluir o arquivo: ${storageError.message}` };
    const { error } = await firebase.from(movement.sourceCollection || 'stock_movements').update({ attachment_path: null, attachment_name: null }).eq('id', movement.id);
    return error ? { error: error.message } : { success: true };
}

async function ensureProductInFirebase(firebase, product) {
    const supplierName = product.supplier || 'Sem fornecedor';
    const { data: supplier, error: supplierError } = await firebase.from('suppliers').upsert({ name: supplierName }, { onConflict: 'name' }).select('id').single();
    if (supplierError) return { error: `Não foi possível salvar o fornecedor: ${supplierError.message}` };
    const { data: existing, error: lookupError } = await firebase
        .from('products')
        .select('id, stock, unit, suppliers(name)')
        .eq('name', product.name)
        .eq('supplier_id', supplier.id)
        .maybeSingle();
    if (lookupError) return { error: `Não foi possível consultar o produto: ${lookupError.message}` };
    if (existing) return { product: existing };

    const categoryName = product.category || 'Sem categoria';
    const { data: category, error: categoryError } = await firebase.from('categories').upsert({ name: categoryName }, { onConflict: 'name' }).select('id').single();
    if (categoryError) return { error: `Não foi possível salvar a categoria: ${categoryError.message}` };
    const { data: created, error: createError } = await firebase.from('products').insert({ name: product.name, category_id: category.id, supplier_id: supplier.id, unit: product.unit || 'kg', stock: Number(product.stock || 0), min_stock: Number(product.minStock || 10), active: true }).select('id, stock, unit, suppliers(name)').single();
    return createError ? { error: `Não foi possível sincronizar o produto: ${createError.message}` } : { product: created };
}

function isMissingMovementFunction(error) {
    return error.code === 'PGRST202' || error.code === '42883' || /could not find the function|function .* does not exist/i.test(error.message || '');
}

async function persistMovementDirectly(firebase, movement, product, nextStock, userId, performedBy) {
    const { error: updateError } = await firebase.from('products').update({ stock: nextStock, updated_at: new Date().toISOString() }).eq('id', product.id);
    if (updateError) return { error: updateError.message };
    const movementRow = { id: movement.id, product_id: product.id, type: movement.type, quantity: movement.quantity, previous_stock: Number(product.stock || 0), new_stock: nextStock, movement_date: movement.date, note: movement.note, unit_price: movement.unitValue, document_number: movement.document, attachment_path: movement.attachmentPath || null, attachment_name: movement.attachment?.name || null, user_id: userId || null, performed_by: performedBy || 'Autor não informado' };
    let { error: insertError } = await firebase.from('stock_movements').insert(movementRow);
    if (insertError && isAttachmentSchemaError(insertError)) {
        const { attachment_path, attachment_name, ...legacyMovementRow } = movementRow;
        const retry = await firebase.from('stock_movements').insert(legacyMovementRow);
        insertError = retry.error;
        if (!insertError) movement.attachmentWarning = 'Movimentação salva. O anexo foi enviado, mas não pôde ser vinculado ao histórico.';
    }
    if (insertError) return { error: insertError.message };
    return { movement, nextStock };
}

function isAttachmentSchemaError(error) {
    return /attachment_(path|name)|schema cache|could not find the .* column/i.test(error?.message || '');
}
