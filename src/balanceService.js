export function calculateBalance(contract, movements = []) {
    const productMovements = movements.filter(movement => movement.productId === contract.productId || movement.product === contract.productName);
    const received = productMovements.filter(movement => movement.type === 'entrada').reduce((total, movement) => total + Number(movement.quantity || 0), 0);
    const used = productMovements.filter(movement => movement.type === 'saida').reduce((total, movement) => total + Number(movement.quantity || 0), 0);
    const ordered = Number(contract.ordered || 0);
    return {
        ordered,
        received,
        used,
        available: Math.max(0, received - used),
        toReceive: Math.max(0, ordered - received),
        orderedValue: ordered * Number(contract.unitValue || 0),
        receivedValue: productMovements.filter(movement => movement.type === 'entrada').reduce((total, movement) => total + Number(movement.totalValue || (movement.quantity || 0) * (movement.unitValue || contract.unitValue || 0)), 0),
        usedValue: productMovements.filter(movement => movement.type === 'saida').reduce((total, movement) => total + Number(movement.totalValue || (movement.quantity || 0) * (movement.unitValue || contract.unitValue || 0)), 0)
    };
}

export function validateWeeklyExit(product, quantity) {
    const available = Number(product?.stock || 0);
    const requested = Number(quantity);
    if (!Number.isFinite(requested) || requested <= 0) return 'Informe uma quantidade válida.';
    if (requested > available) return `Quantidade indisponível. O saldo atual deste produto é de ${available} ${product?.unit || ''}.`;
    return null;
}

export function monthKey(date) {
    return String(date || '').slice(0, 7);
}
