const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const request = async (path, options = {}) => {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const token = localStorage.getItem('bayaa-token');
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
  updateSellerOrderStatus: (id, status) => request(`/api/seller/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createPayment: (payload) => request('/api/payments/create', { method: 'POST', body: JSON.stringify(payload) }),
};

export const saveApiSession = ({ user, token }) => {
  localStorage.setItem('bayaa-token', token);
  localStorage.setItem('bayaa-session', JSON.stringify(user));
};

export const clearApiSession = () => {
  localStorage.removeItem('bayaa-token');
  localStorage.removeItem('bayaa-session');
};
