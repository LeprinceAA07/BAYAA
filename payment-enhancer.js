(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const isOrderCreate = method === 'POST' && /\/api\/orders$/.test(new URL(url, window.location.origin).pathname);
    let popup = null;
    if (isOrderCreate) {
      try {
        const body = init.body ? JSON.parse(init.body) : null;
        if (body?.paymentMethod && body.paymentMethod !== 'cod') {
          popup = window.open('about:blank', '_blank');
          if (popup) popup.document.write('<title>Moosyl</title><p style="font-family:sans-serif;text-align:center;margin-top:40vh">جاري تجهيز الدفع…</p>');
        }
      } catch {}
    }
    const response = await originalFetch(input, init);
    if (isOrderCreate && response.ok) {
      try {
        const order = await response.clone().json();
        const body = init.body ? JSON.parse(init.body) : null;
        if (body?.paymentMethod && body.paymentMethod !== 'cod' && order?.order?.payment_transaction_id) {
          const token = localStorage.getItem('bayaa-token');
          const checkoutResponse = await originalFetch('/api/payments/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ amount: Number(body.total), transactionId: order.order.payment_transaction_id })
          });
          const data = await checkoutResponse.json().catch(() => ({}));
          if (checkoutResponse.ok && data.checkoutUrl) {
            if (popup && !popup.closed) popup.location.href = data.checkoutUrl;
            else window.location.href = data.checkoutUrl;
          } else if (popup && !popup.closed) popup.close();
        }
      } catch {
        if (popup && !popup.closed) popup.close();
      }
    }
    return response;
  };
})();
