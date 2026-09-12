(() => {
  const sellerPhones = new Map();

  const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

  const loadSellerContacts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json().catch(() => ({}));
      for (const product of data.products || []) {
        const phone = normalizePhone(product.seller_phone);
        if (phone && product.title) sellerPhones.set(String(product.title).trim(), phone);
      }
    } catch {}
  };

  const contactButton = (phone) => {
    const href = `https://wa.me/${phone}`;
    return `<a class="bayaa-contact-seller" href="${href}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:9px;padding:10px 12px;border-radius:12px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">💬 تواصل مباشرة مع البائع</a>`;
  };

  const cleanBuyerCheckout = () => {
    document.querySelectorAll('.payment-section').forEach((section) => {
      section.style.display = 'none';
    });
    document.querySelectorAll('.checkout-modal h2').forEach((heading) => {
      heading.textContent = 'إرسال طلب للبائع';
    });
    document.querySelectorAll('.checkout-modal p').forEach((p) => {
      if (p.textContent.includes('بيانات التوصيل') || p.textContent.includes('الدفع')) {
        p.textContent = 'أرسل بيانات التواصل للبائع مباشرة. لا يوجد دفع من المشتري داخل BAYAA.';
      }
    });
    document.querySelectorAll('.checkout-modal button[type="submit"]').forEach((button) => {
      button.textContent = 'إرسال الطلب للبائع';
    });
  };

  const addSellerContactButtons = () => {
    document.querySelectorAll('.product').forEach((card) => {
      if (card.querySelector('.bayaa-contact-seller')) return;
      const title = card.querySelector('h3')?.textContent?.trim();
      const phone = title && sellerPhones.get(title);
      if (!phone) return;
      const body = card.querySelector('.product-body');
      if (body) body.insertAdjacentHTML('beforeend', contactButton(phone));
    });

    document.querySelectorAll('.modal').forEach((modal) => {
      if (modal.querySelector('.bayaa-contact-seller')) return;
      const title = modal.querySelector('h2')?.textContent?.trim();
      const phone = title && sellerPhones.get(title);
      if (!phone) return;
      const action = modal.querySelector('.checkout');
      if (action) action.insertAdjacentHTML('afterend', contactButton(phone));
    });
  };

  const run = () => {
    cleanBuyerCheckout();
    addSellerContactButtons();
  };

  const start = async () => {
    await loadSellerContacts();
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
