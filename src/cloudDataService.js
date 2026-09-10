export async function loadCloudDataFromSupabase(supabase) {
    const [{ data: products, error: productsError }, { data: movements, error: movementsError }, { data: orders, error: ordersError }] = await Promise.all([
        supabase.from('products').select('*, categories(name), suppliers(name)').eq('active', true).order('name'),
        supabase.from('stock_movements').select('*, products(name, suppliers(name))').order('created_at', { ascending: false }),
        supabase.from('orders').select('*, products(name), suppliers(name), receipts(*)').order('created_at', { ascending: false })
    ]);
    if (productsError) return { error: productsError.message };
    return {
        warning: movementsError || ordersError ? 'Alguns relatórios não puderam ser carregados.' : null,
        data: {
            products: (products || []).map(product => ({ ...product, category: product.categories?.name || 'Sem categoria', supplier: product.suppliers?.name || 'Sem fornecedor', minStock: Number(product.min_stock || 0), stock: Number(product.stock || 0), unit: product.unit || 'un' })),
            movements: movementsError ? [] : (movements || []).map(movement => ({ id: movement.id, date: movement.movement_date, time: new Date(movement.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), product: movement.products?.name || 'Produto removido', type: movement.type, quantity: Number(movement.quantity), delta: Number(movement.new_stock || 0) - Number(movement.previous_stock || 0), user: movement.performed_by || 'Autor não informado', note: movement.note || '', supplier: movement.products?.suppliers?.name || '' })),
            orders: ordersError ? [] : (orders || []).map(order => ({ product: order.products?.name || 'Produto não identificado', ordered: Number(order.ordered_quantity || 0), receipts: (order.receipts || []).map(receipt => [receipt.receipt_date, Number(receipt.quantity || 0)]) }))
        }
    };
}
