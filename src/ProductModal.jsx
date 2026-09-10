import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function ProductModal({ modal, products, onClose, onSave, onAddProduct }) {
    const [form, setForm] = useState({
        productId: modal.productId || products[0]?.id,
        type: modal.type,
        quantity: '',
        stock: 0,
        date: new Date().toISOString().slice(0, 10),
        note: '',
        name: '',
        category: 'Hortifruti',
        supplier: '',
        unit: 'kg',
        minStock: 10
    });

    const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
    const isNew = modal.type === 'newProduct';

    return (
        <div className="overlay">
            <div className="modal">
                <button className="close" onClick={onClose} aria-label="Fechar"><X /></button>
                <h2>{isNew ? 'Novo produto' : form.type === 'entrada' ? 'Registrar entrada' : form.type === 'saida' ? 'Registrar saída' : 'Ajustar estoque'}</h2>
                {isNew ? (
                    <>
                        <label>Nome<input value={form.name} onChange={event => change('name', event.target.value)} /></label>
                        <label>Categoria<input value={form.category} onChange={event => change('category', event.target.value)} /></label>
                        <label>Fornecedor<input value={form.supplier} onChange={event => change('supplier', event.target.value)} /></label>
                        <div className="two">
                            <label>Estoque inicial<input type="number" min="0" value={form.stock} onChange={event => change('stock', event.target.value)} /></label>
                            <label>Unidade<input value={form.unit} onChange={event => change('unit', event.target.value)} /></label>
                        </div>
                        <label>Estoque mínimo<input type="number" min="0" value={form.minStock} onChange={event => change('minStock', event.target.value)} /></label>
                        <button className="primary full" onClick={() => form.name.trim() && onAddProduct(form)}>Cadastrar produto</button>
                    </>
                ) : (
                    <>
                        <label>Produto<select value={form.productId} onChange={event => change('productId', event.target.value)}>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                        <div className="two">
                            <label>Quantidade<input type="number" min="0" value={form.quantity} onChange={event => change('quantity', event.target.value)} /></label>
                            <label>Data<input type="date" value={form.date} onChange={event => change('date', event.target.value)} /></label>
                        </div>
                        <label>Observação<textarea value={form.note} onChange={event => change('note', event.target.value)} placeholder="Ex.: número da NF ou destino" /></label>
                        <button className="primary full" onClick={() => Number(form.quantity) > 0 && onSave(form)}>Salvar movimentação</button>
                    </>
                )}
            </div>
        </div>
    );
}
