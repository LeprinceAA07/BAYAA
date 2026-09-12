(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
    const isOrderCreate = method === 'POST' && /\/api\/orders$/.test(new URL(url, window.location.origin).pathname);
    let requestInit = init;
    let orderBody = null;

    if (isOrderCreate) {
      try {
        orderBody = init.body ? JSON.parse(init.body) : {};
        orderBody.paymentMethod = 'card';
        requestInit = { ...init, body: JSON.stringify(orderBody), headers: { ...(init.headers || {}), 'Content-Type': 'application/json' } };
      } catch {}
    }

    let popup = null;
    if (isOrderCreate) {
      popup = window.open('about:blank', '_blank');
      if (popup) popup.document.write('<title>BAYAA - Paiement</title><p style="font-family:sans-serif;text-align:center;margin-top:40vh">Préparation du paiement Visa / Mastercard…</p>');
    }

    const response = await originalFetch(input, requestInit);
    if (isOrderCreate && response.ok) {
      try {
        const orderResponse = await response.clone().json();
        const order = orderResponse?.order || {};
        const transactionId = order.transaction_id || order.payment_transaction_id;
        if (!transactionId) throw new Error('Transaction ID missing.');
        const token = localStorage.getItem('bayaa-token');
        const checkoutResponse = await originalFetch('/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ amount: Number(orderBody?.total), transactionId })
        });
        const data = await checkoutResponse.json().catch(() => ({}));
        if (checkoutResponse.ok && data.checkoutUrl) {
          if (popup && !popup.closed) popup.location.href = data.checkoutUrl;
          else window.location.href = data.checkoutUrl;
        } else {
          if (popup && !popup.closed) popup.close();
          console.warn('BAYAA checkout unavailable:', data?.error || 'Unknown payment error');
        }
      } catch (error) {
        if (popup && !popup.closed) popup.close();
        console.warn('BAYAA payment initialization failed:', error);
      }
    }
    return response;
  };
})();
