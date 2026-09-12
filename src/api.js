const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const request = async (path, options = {}) => {
  const token = localStorage.getItem('bayaa-token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'حدث خطأ في الاتصال بالخادم.');
  return data;
};

export const api = {
  health: () => request('/api/health'),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/api/me'),
  products: (params = {}) => request(`/api/products?${new URLSearchParams(params).toString()}`),
  createProduct: (payload) => request('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  createOrder: (payload) => request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  myOrders: () => request('/api/orders/mine'),
  sellerOrders: () => request('/api/seller/orders'),
};

export const saveApiSession = ({ user, token }) => {
  localStorage.setItem('bayaa-token', token);
  localStorage.setItem('bayaa-session', JSON.stringify(user));
};

export const clearApiSession = () => localStorage.removeItem('bayaa-token');
