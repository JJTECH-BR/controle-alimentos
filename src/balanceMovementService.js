export async function persistBalanceMovement({ firebase, product, form, userId, performedBy }) {
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Informe uma quantidade válida.' };

    const movement = {
        id: crypto.randomUUID(),
        date: form.date || new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        product: product.name,
        productId: product.id,
        type: form.type,
        quantity,
        user: performedBy || 'Autor não informado',
        note: form.note || '',
        supplier: form.supplier || product.supplier,
        unitValue: Number(form.unitValue || 0),
        totalValue: Number(form.totalValue || quantity * Number(form.unitValue || 0)),
        document: form.document || ''
    };

    if (firebase) {
        let attachmentPath = '';
        let attachmentName = '';
        if (form.attachment instanceof File) {
            const safeName = form.attachment.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
            attachmentPath = `${movement.id}/${safeName}`;
            attachmentName = form.attachment.name;
            const { error: attachmentError } = await firebase.attachments.from('movement-attachments').upload(attachmentPath, form.attachment, { contentType: form.attachment.type });
            if (attachmentError) return { error: attachmentError.message };
        }
        const { error } = await firebase.from('balance_movements').insert({
            id: movement.id,
            product_id: product.id,
            type: movement.type,
            quantity: movement.quantity,
            movement_date: movement.date,
            note: movement.note,
            unit_price: movement.unitValue,
            document_number: movement.document,
            user_id: userId || null,
            performed_by: movement.user,
            attachment_path: attachmentPath,
            attachment_name: attachmentName,
            created_at: new Date().toISOString()
        });
        if (error) {
            if (attachmentPath) await firebase.attachments.from('movement-attachments').remove([attachmentPath]);
            return { error: error.message };
        }
        movement.attachmentPath = attachmentPath;
        movement.attachmentName = attachmentName;
        movement.sourceCollection = 'balance_movements';
        movement.attachmentUrl = attachmentPath ? (await firebase.attachments.from('movement-attachments').createSignedUrl(attachmentPath)).data?.signedUrl || '' : '';
    }

    return { movement };
}
