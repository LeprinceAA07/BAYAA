(() => {
  const originalFetch = window.fetch.bind(window);
  if (window.__bayaaPaymentEnhanced) return;
  window.__bayaaPaymentEnhanced = true;

  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);

    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : 'GET')).toUpperCase();
      const isOrderCreate = method === 'POST' && new URL(url, window.location.origin).pathname === '/api/orders';
      if (!isOrderCreate || !response.ok) return response;

      const rawBody = init?.body;
      const orderPayload = typeof rawBody === 'string' ? JSON.parse(rawBody) : null;
      if (!orderPayload || orderPayload.paymentMethod === 'cod') return response;

      const orderResponse = await response.clone().json();
      const orderId = orderResponse?.order?.id;
      if (!orderId) return response;

      const transactionId = `order_${orderId}`;
      const token = localStorage.getItem('bayaa-token');
      const checkoutResponse = await originalFetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount: Number(orderPayload.total), transactionId }),
      });

      const checkout = await checkoutResponse.json().catch(() => ({}));
      if (!checkoutResponse.ok || !checkout.checkoutUrl) {
        console.error('BAYAA payment checkout error:', checkout?.error || 'No checkout URL');
        return response;
      }

      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      console.error('BAYAA payment enhancement failed:', error);
    }

    return response;
  };
})();
