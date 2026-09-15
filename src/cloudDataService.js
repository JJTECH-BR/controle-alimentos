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
    const [{ data: products, error: productsError }, { data: movements, error: movementsError }, { data: orders, error: ordersError }, { data: auditLogs, error: auditLogsError }] = await Promise.all([
        supabase.from('products').select('*, categories(name), suppliers(name)').eq('active', true).order('name'),
        supabase.from('stock_movements').select('*, products(name, suppliers(name))').order('created_at', { ascending: false }),
        supabase.from('orders').select('*, products(name), suppliers(name), receipts(*)').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false })
    ]);
    if (productsError) return { error: `Produtos: ${productsError.message}` };

    const normalizedProducts = (products || []).map(product => ({ ...product, category: product.categories?.name || 'Sem categoria', supplier: product.suppliers?.name || 'Sem fornecedor', minStock: Number(product.min_stock || 0), stock: Number(product.stock || 0), unit: product.unit || 'un' }));
    const effectiveProducts = normalizedProducts.length ? normalizedProducts : fallbackProducts;

    const failedReports = [
        movementsError && 'movimentações',
        ordersError && 'empenhos e recebimentos',
        auditLogsError && 'atividade do sistema'
    ].filter(Boolean);
    return {
        warning: failedReports.length ? `Não foi possível carregar: ${failedReports.join(', ')}. ${['42P01', 'PGRST205'].includes(auditLogsError?.code) ? 'Execute o supabase-schema.sql atualizado para criar a tabela de auditoria.' : 'Verifique as tabelas e as políticas RLS no Supabase.'}` : null,
        data: {
            products: effectiveProducts,
            movements: movementsError ? [] : (movements || []).map(movement => ({ id: movement.id, date: movement.movement_date, time: new Date(movement.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), product: movement.products?.name || 'Produto removido', type: movement.type, quantity: Number(movement.quantity), delta: Number(movement.new_stock || 0) - Number(movement.previous_stock || 0), user: formatUserName(movement.performed_by), note: movement.note || '', supplier: movement.products?.suppliers?.name || '' })),
            orders: ordersError ? [] : (orders || []).map(order => ({ product: order.products?.name || 'Produto não identificado', ordered: Number(order.ordered_quantity || 0), receipts: (order.receipts || []).map(receipt => [receipt.receipt_date, Number(receipt.quantity || 0)]) })),
            auditLogs: auditLogsError ? [] : (auditLogs || []).map(log => ({ id: log.id, date: log.created_at?.slice(0, 10), time: log.created_at ? new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '', user: formatUserName(log.performed_by), action: log.action, entityType: log.entity_type, entityId: log.entity_id, details: log.details || '' }))
        }
    };
}
