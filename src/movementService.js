export async function persistMovement({ supabase, product, form, userId, performedBy }) {
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
        attachment: form.attachment || null
    };

    if (supabase) {
        const { data, error } = await supabase.rpc('register_stock_movement', {
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
        if (error) return { error: error.message };
        const result = Array.isArray(data) ? data[0] : data;
        if (!result) return { error: 'O Supabase não retornou o resultado da movimentação.' };
        movement.delta = Number(result.new_stock) - Number(result.previous_stock);
        return { movement, nextStock: Number(result.new_stock) };
    }

    return { movement, nextStock };
}
