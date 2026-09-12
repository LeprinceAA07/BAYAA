const token = () => localStorage.getItem('bayaa-token');
const request = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const t = token(); if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...options, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'حدث خطأ.');
  return data;
};

window.bayaaProductManager = { update: (id, payload) => request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) };
