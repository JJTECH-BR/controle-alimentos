import React from 'react';

function displayDate(value) {
    if (!value) return '';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : '';
}

function isoDate(value) {
    const digits = String(value).replace(/\D/g, '').slice(0, 8);
    if (digits.length !== 8) return null;
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return null;
    return `${year}-${month}-${day}`;
}

export default function DateInput({ value, onChange }) {
    const handleChange = event => {
        const formatted = event.target.value.replace(/\D/g, '').slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2}\/\d{2})(\d)/, '$1/$2');
        onChange(isoDate(formatted) || formatted);
    };

    return <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} value={displayDate(value).length === 10 ? displayDate(value) : value || ''} onChange={handleChange} />;
}