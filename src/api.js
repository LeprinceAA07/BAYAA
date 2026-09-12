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
  updateProduct: (id, payload) => request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
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

/**
 * Compress image file to JPEG base64 data URL.
 * Scales down if needed and compresses to ~80% quality.
 * Max output: ~200KB base64 encoded.
 */
export const compressImageToDataUrl = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid image file.');
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Scale down if larger than 1200px on longest side
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 80% quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Validate size (base64 should fit in 1mb payload limit with product data)
        if (dataUrl.length > 800000) {
          return reject(new Error('Compressed image is too large. Try a smaller file.'));
        }
        
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};

