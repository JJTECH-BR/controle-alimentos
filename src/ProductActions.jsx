import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { isFirebaseConfigured, firebaseCompat as firebase } from './firebase';

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
        if (!form.name.trim()) { setFeedback('Informe o nome do produto.'); return; }
        setBusy(true);
        const updatedProduct = {
            id: product.id,
            name: form.name.trim().toUpperCase(),
            category: form.category.trim() || 'Sem categoria',
            supplier: form.supplier.trim() || 'Sem fornecedor',
            unit: form.unit.trim() || 'kg',
            minStock: Number(form.minStock || 0)
        };
        try {
            if (isFirebaseConfigured) {
                const { data: category, error: categoryError } = await firebase.from('categories').upsert({ name: updatedProduct.category }, { onConflict: 'name' }).select('id').single();
                if (categoryError) throw new Error(`Não foi possível salvar a categoria: ${categoryError.message}`);
                const { data: supplier, error: supplierError } = await firebase.from('suppliers').upsert({ name: updatedProduct.supplier }, { onConflict: 'name' }).select('id').single();
                if (supplierError) throw new Error(`Não foi possível salvar o fornecedor: ${supplierError.message}`);
                const { error } = await firebase.from('products').update({ name: updatedProduct.name, category_id: category.id, supplier_id: supplier.id, unit: updatedProduct.unit, min_stock: updatedProduct.minStock, updated_at: new Date().toISOString() }).eq('id', product.id);
                if (error) throw new Error(`Não foi possível editar o produto: ${error.message}`);
            }
            await onAudit?.('Alterou produto', 'produto', product.id, `${product.name} → ${updatedProduct.name}`);
            await onProductChange({ id: product.id, product: updatedProduct, previousProduct: product });
            setEditing(false);
        } catch (error) {
            setFeedback(error.message || 'Não foi possível editar o produto.');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirming) { setConfirming(true); return; }
        setBusy(true);
        try {
            if (isFirebaseConfigured) {
                const { error } = await firebase.from('products').update({ active: false, updated_at: new Date().toISOString() }).eq('id', product.id);
                if (error) throw new Error(`Não foi possível excluir o produto: ${error.message}`);
            }
            await onAudit?.('Excluiu produto', 'produto', product.id, product.name);
            await onProductChange({ id: product.id, deleted: true });
            setConfirming(false);
        } catch (error) {
            setFeedback(error.message || 'Não foi possível excluir o produto.');
        } finally {
            setBusy(false);
        }
    };

    return <>
        <div className="actions">
            {Number(product.stock || 0) > 0 && <button onClick={() => onMove('saida', product.id)}>Registrar consumo</button>}
            <button type="button" className="actionEdit" onClick={() => { setForm({ name: product.name, category: product.category || '', supplier: product.supplier || '', unit: product.unit || 'kg', minStock: product.minStock ?? 10 }); setFeedback(''); setEditing(true); }} disabled={busy} title="Editar produto" aria-label={`Editar ${product.name}`}><Pencil size={15} /></button>
            <button type="button" className="actionDelete" onClick={() => { setFeedback(''); remove(); }} disabled={busy} title="Excluir produto" aria-label={`Excluir ${product.name}`}><Trash2 size={15} /></button>
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
                {feedback && <div className="inlineAlert">{feedback}</div>}
                <div className="confirmActions"><button type="button" className="secondary" onClick={() => { setConfirming(false); setFeedback(''); }} disabled={busy}>Cancelar</button><button type="button" className="danger" onClick={remove} disabled={busy}>{busy ? 'Excluindo…' : 'Sim, excluir'}</button></div>
            </div>
        </div>}
    </>;
}
