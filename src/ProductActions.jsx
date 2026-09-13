import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabase';

export default function ProductActions({ product, onMove, onProductChange, onAudit }) {
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [form, setForm] = useState({
        name: product.name,
        category: product.category || '',
        supplier: product.supplier || '',
        unit: product.unit || 'kg',
        minStock: product.minStock ?? 10
    });

    const change = (key, value) => setForm(current => ({ ...current, [key]: value }));

    const save = async () => {
        if (!form.name.trim()) return;
        setBusy(true);
        if (!isSupabaseConfigured) {
            await onProductChange({
                id: product.id,
                name: form.name.trim().toUpperCase(),
                category: form.category.trim() || 'Sem categoria',
                supplier: form.supplier.trim() || 'Sem fornecedor',
                unit: form.unit.trim() || 'kg',
                minStock: Number(form.minStock || 0)
            });
            await onAudit?.('Alterou produto', 'produto', product.id, `${product.name} → ${form.name.trim().toUpperCase()}`);
            setBusy(false);
            setEditing(false);
            return;
        }
        const { data: category, error: categoryError } = await supabase.from('categories').upsert({ name: form.category.trim() || 'Sem categoria' }, { onConflict: 'name' }).select('id').single();
        if (categoryError) { setBusy(false); setFeedback(`Não foi possível salvar a categoria: ${categoryError.message}`); return; }
        const { data: supplier, error: supplierError } = await supabase.from('suppliers').upsert({ name: form.supplier.trim() || 'Sem fornecedor' }, { onConflict: 'name' }).select('id').single();
        if (supplierError) { setBusy(false); setFeedback(`Não foi possível salvar o fornecedor: ${supplierError.message}`); return; }
        const { error } = await supabase.from('products').update({ name: form.name.trim().toUpperCase(), category_id: category.id, supplier_id: supplier.id, unit: form.unit.trim() || 'kg', min_stock: Number(form.minStock || 0), updated_at: new Date().toISOString() }).eq('id', product.id);
        setBusy(false);
        if (error) { setFeedback(`Não foi possível editar o produto: ${error.message}`); return; }
        setEditing(false);
        await onAudit?.('Alterou produto', 'produto', product.id, `${product.name} → ${form.name.trim().toUpperCase()}`);
        await onProductChange();
    };

    const remove = async () => {
        if (!confirming) { setConfirming(true); return; }
        if (!isSupabaseConfigured) {
            setConfirming(false);
            await onAudit?.('Excluiu produto', 'produto', product.id, product.name);
            await onProductChange(product.id);
            return;
        }
        setBusy(true);
        const { error } = await supabase.from('products').update({ active: false, updated_at: new Date().toISOString() }).eq('id', product.id);
        setBusy(false);
        if (error) { setFeedback(`Não foi possível excluir o produto: ${error.message}`); return; }
        setConfirming(false);
        await onAudit?.('Excluiu produto', 'produto', product.id, product.name);
        await onProductChange();
    };

    return <>
        <div className="actions">
            {Number(product.stock || 0) > 0 && <button onClick={() => onMove('saida', product.id)}>Registrar consumo</button>}
            <button className="actionEdit" onClick={() => setEditing(true)} disabled={busy} title="Editar produto" aria-label={`Editar ${product.name}`}><Pencil size={15} /></button>
            <button className="actionDelete" onClick={remove} disabled={busy} title="Excluir produto" aria-label={`Excluir ${product.name}`}><Trash2 size={15} /></button>
        </div>
        {editing && <div className="overlay">
            <div className="modal productEditModal">
                <button className="close" onClick={() => setEditing(false)} aria-label="Fechar">×</button>
                <h2>Editar produto</h2>
                {feedback && <div className="inlineAlert">{feedback}</div>}
                <label>Nome<input value={form.name} onChange={event => change('name', event.target.value)} /></label>
                <label>Categoria<input value={form.category} onChange={event => change('category', event.target.value)} /></label>
                <label>Fornecedor<input value={form.supplier} onChange={event => change('supplier', event.target.value)} /></label>
                <div className="two"><label>Unidade<input value={form.unit} onChange={event => change('unit', event.target.value)} /></label><label>Estoque mínimo<input type="number" min="0" value={form.minStock} onChange={event => change('minStock', event.target.value)} /></label></div>
                <button className="primary full" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
            </div>
        </div>}
        {confirming && <div className="overlay">
            <div className="modal confirmModal">
                <h2>Excluir produto?</h2>
                <p>O produto <strong>{product.name}</strong> será removido das telas. O histórico de movimentações será preservado.</p>
                <div className="confirmActions"><button className="secondary" onClick={() => setConfirming(false)}>Cancelar</button><button className="danger" onClick={remove} disabled={busy}>{busy ? 'Excluindo…' : 'Sim, excluir'}</button></div>
            </div>
        </div>}
    </>;
}
