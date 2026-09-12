(() => {
  const originalFetch = window.fetch.bind(window);
  const sellerPhones = new Map();

  const normalizePhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length === 8 ? `222${digits}` : digits;
  };

  const authHeaders = () => {
    const token = localStorage.getItem('bayaa-token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const addContactButtons = () => {
    document.querySelectorAll('.modal').forEach(modal => {
      if (modal.querySelector('[data-bayaa-contact]')) return;
      const title = modal.querySelector('h2')?.textContent?.trim();
      if (!title) return;
      let phone = '';
      sellerPhones.forEach((value, key) => { if (!phone && key === title) phone = value; });
      if (!phone) return;
      const normalized = normalizePhone(phone);
      if (!normalized) return;
      const box = document.createElement('div');
      box.dataset.bayaaContact = '1';
      box.style.cssText = 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap';
      const wa = document.createElement('a');
      wa.href = `https://wa.me/${normalized}`;
      wa.target = '_blank';
      wa.rel = 'noopener noreferrer';
      wa.textContent = 'واتساب مع البائع';
      wa.style.cssText = 'flex:1;text-align:center;text-decoration:none;padding:12px 14px;border-radius:12px;background:#25d366;color:#fff;font-weight:700';
      const call = document.createElement('a');
      call.href = `tel:+${normalized}`;
      call.textContent = 'اتصال بالبائع';
      call.style.cssText = 'flex:1;text-align:center;text-decoration:none;padding:12px 14px;border-radius:12px;background:#111827;color:#fff;font-weight:700';
      box.append(wa, call);
      modal.appendChild(box);
    });
  };

  const addSellerContactForm = () => {
    const panel = document.querySelector('.seller-panel');
    if (!panel || panel.querySelector('[data-bayaa-seller-contact]')) return;
    const wrap = document.createElement('div');
    wrap.dataset.bayaaSellerContact = '1';
    wrap.style.cssText = 'margin-top:18px;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#f8fafc';
    wrap.innerHTML = '<strong style="display:block;margin-bottom:8px">رقم تواصل البائع</strong><p style="margin:0 0 10px;color:#64748b;font-size:13px">هذا الرقم سيظهر للمشترين للتواصل معك مباشرة عبر واتساب أو الاتصال.</p><div style="display:flex;gap:8px"><input data-bayaa-phone type="tel" inputmode="numeric" placeholder="رقم واتساب الموريتاني" style="flex:1;padding:11px;border:1px solid #d1d5db;border-radius:10px"><button data-bayaa-save type="button" style="padding:11px 14px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700">حفظ</button></div><small data-bayaa-msg style="display:block;margin-top:8px;color:#64748b"></small>';
    const phone = wrap.querySelector('[data-bayaa-phone]');
    const save = wrap.querySelector('[data-bayaa-save]');
    const msg = wrap.querySelector('[data-bayaa-msg]');
    save.addEventListener('click', async () => {
      const value = phone.value.trim();
      if (!value) { msg.textContent = 'أدخل رقمًا صحيحًا.'; return; }
      save.disabled = true;
      try {
        const r = await originalFetch('/api/me/contact', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ contactPhone: value }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'تعذر حفظ الرقم.');
        msg.textContent = 'تم حفظ رقم التواصل.';
      } catch (e) { msg.textContent = e.message; }
      finally { save.disabled = false; }
    });
    panel.querySelector('.seller-content')?.appendChild(wrap) || panel.appendChild(wrap);
  };

  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const pathname = new URL(url, window.location.origin).pathname;
      if (response.ok && pathname === '/api/products') {
        const data = await response.clone().json();
        for (const product of (data.products || [])) {
          if (product.title && product.seller_phone) sellerPhones.set(product.title, product.seller_phone);
        }
      }
    } catch {}
    return response;
  };

  const observer = new MutationObserver(() => {
    addContactButtons();
    addSellerContactForm();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => { addContactButtons(); addSellerContactForm(); });
})();
