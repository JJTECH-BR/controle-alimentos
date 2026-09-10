export async function persistMovement({ supabase, product, form, userId, performedBy }) {
    const quantity = Number(form.quantity);
    const currentStock = Number(product.stock || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Informe uma quantidade válida.' };
    if (form.type === 'saida' && quantity > currentStock) return { error: `A saída solicitada (${quantity}) é maior que o estoque atual (${currentStock}).` };

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
        supplier: product.supplier
    };

    if (supabase) {
        const { error: movementError } = await supabase.from('stock_movements').insert({
            id: movement.id,
            product_id: product.id,
            type: form.type,
            quantity,
            previous_stock: currentStock,
            new_stock: nextStock,
            movement_date: movement.date,
            note: movement.note,
            user_id: userId || null,
            performed_by: performedBy || 'Autor não informado'
        });
        if (movementError) return { error: movementError.message };

        const { error: productError } = await supabase.from('products').update({ stock: nextStock, updated_at: new Date().toISOString() }).eq('id', product.id);
        if (productError) return { error: productError.message };
    }

    return { movement, nextStock };
}
