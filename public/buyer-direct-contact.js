(() => {
  const sellers = new Map();
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const url = String(args[0]?.url || args[0] || '');
      if (url.includes('/api/products')) {
        const clone = response.clone();
        const data = await clone.json();
        for (const product of data?.products || []) {
          const key = String(product.title || '').trim();
          if (key) sellers.set(key, { phone: String(product.seller_phone || '').replace(/\D/g, ''), name: product.seller_name || '' });
        }
      }
    } catch {}
    return response;
  };

  const enhance = () => {
    document.querySelectorAll('.checkout-modal').forEach(modal => {
      const title = modal.querySelector('h2');
      const intro = modal.querySelector('p');
      const payment = modal.querySelector('.payment-section');
      const submit = modal.querySelector('button[type="submit"].checkout');
      if (title) title.textContent = 'إرسال طلب للبائع';
      if (intro) intro.textContent = 'أدخل بياناتك ليتم التواصل مع البائع مباشرة. لا يوجد دفع من خلال BAYAA.';
      if (payment) payment.remove();
      if (submit) submit.textContent = 'إرسال الطلب';
    });

    document.querySelectorAll('.modal').forEach(modal => {
      const heading = modal.querySelector('h2');
      if (!heading || modal.dataset.sellerContactReady === '1') return;
      const productTitle = heading.textContent?.trim();
      if (!productTitle || productTitle === 'تسجيل الدخول' || productTitle === 'إنشاء حساب' || productTitle === 'إتمام الطلب والدفع') return;
      const seller = sellers.get(productTitle);
      if (!seller?.phone) return;
      modal.dataset.sellerContactReady = '1';
      const box = document.createElement('div');
      box.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0';
      const wa = document.createElement('a');
      wa.href = `https://wa.me/${seller.phone}?text=${encodeURIComponent('السلام عليكم، أنا مهتم بالمنتج: ' + productTitle)}`;
      wa.target = '_blank'; wa.rel = 'noopener noreferrer'; wa.textContent = 'واتساب البائع';
      wa.style.cssText = 'text-align:center;padding:12px;border-radius:10px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700';
      const tel = document.createElement('a');
      tel.href = `tel:${seller.phone}`; tel.textContent = 'اتصال بالبائع';
      tel.style.cssText = 'text-align:center;padding:12px;border-radius:10px;background:#111827;color:#fff;text-decoration:none;font-weight:700';
      box.append(wa, tel);
      heading.insertAdjacentElement('afterend', box);
    });
  };

  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', enhance);
})();
