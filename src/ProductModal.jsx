import React, { useState } from 'react';
import { X } from 'lucide-react';
import DateInput from './DateInput';

const CATEGORY_OPTIONS = ['Alimentos Secos', 'Carnes', 'Hortifruti', 'Laticínios'];
const SUPPLIER_OPTIONS = ['AGROVIDA', 'COOPAFASP', 'AGUA PRETA', 'DA TERRA', 'ELCILAINE', 'FRANCISCO', 'LUIZ RAFAEL', 'MAURICIO', 'MARCIA CORREA', 'REGINALDO', 'PEDRO GERALDO', 'HORÁCIO', 'CCF NUTRI', 'FEC', 'FRIGOBOI', 'MERCADO CENTRAL', 'SENGÉS', 'STS', 'DA ROÇA', 'QUITANDA FRUTASOL'];

export default function ProductModal({ modal, products, onClose, onSave, onAddProduct }) {
    const [form, setForm] = useState({
        productId: modal.productId ? String(modal.productId) : products[0]?.id ? String(products[0].id) : '',
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
                <h2>{isNew ? 'Novo produto' : 'Registrar consumo'}</h2>
                {isNew ? (
                    <>
                        <label>Nome<input value={form.name} onChange={event => change('name', event.target.value)} /></label>
                        <label>Categoria<select value={form.category} onChange={event => change('category', event.target.value)}>{CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
                        <label>Fornecedor<select value={form.supplier} onChange={event => change('supplier', event.target.value)}><option value="">Selecione um fornecedor</option>{SUPPLIER_OPTIONS.map(supplier => <option key={supplier} value={supplier}>{supplier}</option>)}</select></label>
                        <div className="two">
                            <label>Estoque inicial<input type="number" min="0" value={form.stock} onChange={event => change('stock', event.target.value)} /></label>
                            <label>Unidade<input value={form.unit} onChange={event => change('unit', event.target.value)} /></label>
                        </div>
                        <label>Estoque mínimo<input type="number" min="0" value={form.minStock} onChange={event => change('minStock', event.target.value)} /></label>
                        <button className="primary full" onClick={() => form.name.trim() && onAddProduct(form)}>Cadastrar produto</button>
                    </>
                ) : (
                    <>
                        <label>Produto<select value={String(form.productId || '')} onChange={event => change('productId', event.target.value)} disabled={!products.length}><option value="">Selecione um produto</option>{products.map(product => <option key={product.id} value={String(product.id)}>{product.name}</option>)}</select></label>
                        <div className="two">
                            <label>Quantidade consumida<input type="number" min="0" value={form.quantity} onChange={event => change('quantity', event.target.value)} /></label>
                            <label>Data<DateInput value={form.date} onChange={value => change('date', value)} /></label>
                        </div>
                        <label>Observação<textarea value={form.note} onChange={event => change('note', event.target.value)} placeholder="Ex.: refeição, turma ou destino" /></label>
                        <button className="primary full" onClick={() => form.productId && Number(form.quantity) > 0 && onSave({ ...form, type: 'saida' })}>Registrar consumo</button>
                    </>
                )}
            </div>
        </div>
    );
}
