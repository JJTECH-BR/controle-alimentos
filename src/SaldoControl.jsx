import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { calculateBalance, monthKey } from './balanceService';

const today = new Date().toISOString().slice(0, 10);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const number = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value || 0));
const emptyContract = product => ({ productId: product?.id || '', ordered: '', unitValue: '', contractDate: today, note: '' });

export default function SaldoControl({ products, movements, contracts, onContract, onMovement, onEditContract, onDeleteContract }) {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [month, setMonth] = useState(today.slice(0, 7));
    const [modal, setModal] = useState(null);
    const product = products.find(item => String(item.id) === String(selectedProduct));
    const contract = contracts.find(item => Number(item.productId) === Number(selectedProduct));
    const balance = contract ? calculateBalance(contract, movements) : null;
    const controlled = products.map(item => {
        const itemContract = contracts.find(row => Number(row.productId) === Number(item.id));
        return itemContract ? { product: item, contract: itemContract, balance: calculateBalance(itemContract, movements) } : null;
    }).filter(Boolean);
    const monthly = useMemo(() => {
        const list = movements.filter(item => monthKey(item.date) === month && (!selectedProduct || Number(item.productId) === Number(selectedProduct) || item.product === product?.name));
        return {
            entries: list.filter(item => item.type === 'entrada'),
            exits: list.filter(item => item.type === 'saida')
        };
    }, [movements, month, selectedProduct, product]);
    const openMovement = type => setModal({ type, productId: selectedProduct || products[0]?.id });
    const openContractModal = (productId, existingContract = null) => {
        const currentProduct = products.find(item => Number(item.id) === Number(productId));
        if (!currentProduct) return;
        setModal({
            type: 'contract',
            productId: currentProduct.id,
            ...(existingContract || emptyContract(currentProduct)),
            ...(existingContract || {}),
            ordered: existingContract?.ordered ?? '',
            unitValue: existingContract?.unitValue ?? '',
            contractDate: existingContract?.contractDate || today,
            note: existingContract?.note ?? ''
        });
    };
    const handleEditContract = async (productId) => {
        const existingContract = contracts.find(item => Number(item.productId) === Number(productId));
        openContractModal(productId, existingContract || null);
    };
    return <>
        <section className="balanceCards cards">
            <Card title="Produtos controlados" value={controlled.length} />
            <Card title="Total licitado" value={money(controlled.reduce((sum, row) => sum + row.balance.orderedValue, 0))} />
            <Card title="Total recebido" value={number(controlled.reduce((sum, row) => sum + row.balance.received, 0))} />
            <Card title="Saldo disponível" value={number(controlled.reduce((sum, row) => sum + row.balance.available, 0))} />
        </section>
        <div className="balanceToolbar toolbar">
            <div><h2>Controle de saldo interno</h2><p>Contratos, recebimentos e consumo usando os mesmos produtos do estoque.</p></div>
            <button className="primary" onClick={() => openContractModal(product?.id || products[0]?.id)}><Plus size={18} /> Novo contrato</button>
        </div>
        <div className="balanceFilters panel">
            <label>Produto<select value={selectedProduct} onChange={event => setSelectedProduct(event.target.value)}><option value="">Todos os produtos</option>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Mês<select value={month} onChange={event => setMonth(event.target.value)}>{months().map(item => <option key={item} value={item}>{item.split('-').reverse().join('/')}</option>)}</select></label>
            <button className="secondary" onClick={() => openMovement('entrada')}><TrendingUp size={17} /> Registrar entrada</button>
            <button className="secondary" onClick={() => openMovement('saida')}><TrendingDown size={17} /> Saída semanal</button>
        </div>
        {selectedProduct && product && <ProductSummary product={product} contract={contract} balance={balance} movements={movements} onEditContract={handleEditContract} onDeleteContract={onDeleteContract} />}
        {!selectedProduct && <div className="panel tableWrap"><table><thead><tr><th>Produto</th><th>Licitado</th><th>Recebido</th><th>Utilizado</th><th>Disponível</th><th>A receber</th><th>Status</th></tr></thead><tbody>{controlled.map(row => <BalanceRow key={row.product.id} {...row} onSelect={() => setSelectedProduct(String(row.product.id))} />)}</tbody></table>{!controlled.length && <div className="empty">Cadastre um contrato para começar o acompanhamento. Hortifruti pode ser lançado diretamente como entrada.</div>}</div>}
        <section className="panel monthlyPanel"><div className="panelHead"><div><h2>Visão mensal</h2><p>O saldo é acumulado entre os meses e não é zerado.</p></div><CalendarDays size={20} /></div><div className="monthlyGrid"><div><span>Entradas no mês</span><strong>{number(monthly.entries.reduce((sum, item) => sum + Number(item.quantity || 0), 0))}</strong><small>{money(monthly.entries.reduce((sum, item) => sum + Number(item.totalValue || 0), 0))}</small></div><div><span>Saídas no mês</span><strong>{number(monthly.exits.reduce((sum, item) => sum + Number(item.quantity || 0), 0))}</strong><small>{money(monthly.exits.reduce((sum, item) => sum + Number(item.totalValue || 0), 0))}</small></div><div><span>Saldo atual</span><strong>{number(product?.stock || controlled.reduce((sum, row) => sum + row.balance.available, 0))}</strong><small>acumulado</small></div></div></section>
        {modal && <BalanceModal modal={modal} products={products} product={product} onClose={() => setModal(null)} onContract={async form => { if (await onContract(form)) setModal(null); }} onMovement={async form => { if (await onMovement(form)) setModal(null); }} />}
    </>;
}
function Card({ title, value }) { return <div className="card"><div><span>{title}</span><strong>{value}</strong></div><CheckCircle2 size={23} /></div>; }
function BalanceRow({ product, balance, onSelect }) { const status = balance.available <= 0 ? 'Esgotado' : balance.available <= Math.max(balance.ordered * .2, 1) ? 'Baixo' : 'Normal'; return <tr onClick={onSelect} className="clickable"><td><b>{product.name}</b><small>{product.category} · {product.unit}</small></td><td>{number(balance.ordered)} {product.unit}</td><td>{number(balance.received)} {product.unit}</td><td>{number(balance.used)} {product.unit}</td><td>{number(balance.available)} {product.unit}</td><td>{number(balance.toReceive)} {product.unit}</td><td><span className={'balanceStatus ' + status.toLowerCase()}>{status}</span></td></tr>; }
function ProductSummary({ product, contract, balance, movements, onEditContract, onDeleteContract }) { const history = movements.filter(item => Number(item.productId) === Number(product.id) || item.product === product.name); return <section className="panel productSummary"><div className="panelHead"><div><h2>{product.name}</h2><p>{product.category} · {product.supplier} · {product.unit}</p></div><div className="summaryActions"><button className="secondary" type="button" onClick={() => onEditContract?.(product.id)}>Editar</button><button className="actionDelete" type="button" onClick={() => onDeleteContract?.(product.id)}>Excluir</button></div>{balance && <span className="balanceStatus">{balance.available <= 0 ? 'Saldo esgotado' : 'Saldo normal'}</span>}</div>{balance ? <div className="summaryStats"><span>Licitado <b>{number(balance.ordered)} {product.unit}</b></span><span>Recebido <b>{number(balance.received)} {product.unit}</b></span><span>Utilizado <b>{number(balance.used)} {product.unit}</b></span><span>Disponível <b>{number(balance.available)} {product.unit}</b></span><span>A receber <b>{number(balance.toReceive)} {product.unit}</b></span><span>Valor licitado <b>{money(balance.orderedValue)}</b></span></div> : <div className="notice">{product.category === 'Hortifruti' ? 'Hortifruti: registre entradas com quantidade e valor, sem contrato obrigatório.' : 'Este produto ainda não possui contrato de saldo.'}</div>}<div className="movementHistory"><h3>Histórico de movimentações</h3>{history.map(item => <div key={item.id}><span>{item.date} · {item.type === 'entrada' ? 'Entrada' : 'Saída'}</span><b>{number(item.quantity)} {product.unit}</b><em>{money(item.totalValue)}</em></div>)}{!history.length && <small>Nenhuma movimentação registrada.</small>}</div></section>; }
function BalanceModal({ modal, products, onClose, onContract, onMovement }) { const initial = modal.type === 'contract' ? { ...emptyContract(products.find(item => Number(item.id) === Number(modal.productId))), ...modal } : { productId: modal.productId || products[0]?.id, quantity: '', unitValue: '', date: today, note: '', document: '', week: '', supplier: products.find(item => Number(item.id) === Number(modal.productId))?.supplier || '', attachment: null }; const [form, setForm] = useState(initial); const fileInputRef = useRef(null); const update = (key, value) => setForm(current => ({ ...current, [key]: value })); const chosen = products.find(item => Number(item.id) === Number(form.productId)); const total = Number(form.quantity || form.ordered || 0) * Number(form.unitValue || 0); const contractMode = modal.type === 'contract'; const suppliers = [...new Set(products.map(item => item.supplier).filter(Boolean))]; const attach = event => { const file = event.target.files?.[0]; if (!file) return; const fileType = (file.type || '').trim() || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'); update('attachment', { name: file.name, type: fileType, size: Number(file.size || 0) }); }; const removeAttachment = () => { update('attachment', null); if (fileInputRef.current) fileInputRef.current.value = ''; }; return <div className="overlay"><div className="modal balanceModal"><button className="close" onClick={onClose}>×</button><h2>{contractMode ? 'Novo controle licitado' : modal.type === 'entrada' ? 'Registrar entrada recebida' : 'Registrar saída semanal'}</h2><label>Produto<select value={form.productId} onChange={event => { update('productId', event.target.value); const nextProduct = products.find(item => Number(item.id) === Number(event.target.value)); if (modal.type === 'entrada') update('supplier', nextProduct?.supplier || ''); }}>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{contractMode ? <><div className="two"><label>Quantidade licitada<input type="number" min="0" value={form.ordered} onChange={event => update('ordered', event.target.value)} /></label><label>Valor unitário<input type="number" min="0" step="0.01" value={form.unitValue} onChange={event => update('unitValue', event.target.value)} /></label></div><div className="calculated">Valor total licitado: <b>{money(total)}</b></div><label>Data/período<input type="date" value={form.contractDate} onChange={event => update('contractDate', event.target.value)} /></label></> : <><>{modal.type === 'entrada' && <label>Fornecedor<select value={form.supplier} onChange={event => update('supplier', event.target.value)}><option value="">Selecione um fornecedor</option>{suppliers.map(supplier => <option key={supplier} value={supplier}>{supplier}</option>)}</select></label>}</><div className="two"><label>Quantidade<input type="number" min="0" step="0.01" value={form.quantity} onChange={event => update('quantity', event.target.value)} /></label><label>Valor unitário<input type="number" min="0" step="0.01" value={form.unitValue} onChange={event => update('unitValue', event.target.value)} /></label></div><div className="calculated">Valor total: <b>{money(total)}</b></div><label>Data<input type="date" value={form.date} onChange={event => update('date', event.target.value)} /></label>{modal.type === 'saida' && <label>Semana/período<input value={form.week} onChange={event => update('week', event.target.value)} placeholder="Ex.: Semana 1" /></label>}<label>Documento/observação<textarea value={form.note} onChange={event => update('note', event.target.value)} /></label><div className="attachmentField"><span>Anexo</span><div className="attachmentActions"><button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>Anexar foto ou PDF</button>{form.attachment && <button type="button" className="attachmentRemove" onClick={removeAttachment}>Excluir anexo</button>}</div><input ref={fileInputRef} id="balance-attachment" type="file" accept="image/*,.pdf,application/pdf" onChange={attach} />{form.attachment && <small title={form.attachment.name}>{form.attachment.name}</small>}</div></>}<button className="primary full" onClick={() => contractMode ? onContract({ ...form, id: form.id || null, productId: Number(form.productId), totalValue: total }) : onMovement({ ...form, productId: Number(form.productId), type: modal.type, totalValue: total, unitValue: Number(form.unitValue || 0), note: [form.week, form.note].filter(Boolean).join(' · '), supplier: form.supplier, attachment: form.attachment })}>Salvar</button></div></div>; }
function months() { const result = []; const now = new Date(); for (let index = 0; index < 18; index += 1) { const date = new Date(now.getFullYear(), now.getMonth() - index, 1); result.push(date.toISOString().slice(0, 7)); } return result; }
