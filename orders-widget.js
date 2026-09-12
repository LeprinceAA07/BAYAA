(() => {
  const boot = () => {
    if (document.getElementById('bayaa-orders-widget')) return;

    const style = document.createElement('style');
    style.textContent = `
      #bayaa-orders-widget{position:fixed;left:18px;bottom:18px;z-index:9998;font-family:inherit}
      #bayaa-orders-widget .bow-btn{border:0;border-radius:999px;padding:12px 16px;background:#0f766e;color:#fff;font-weight:700;box-shadow:0 10px 30px rgba(15,118,110,.25);cursor:pointer}
      #bayaa-orders-widget .bow-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:18px}
      #bayaa-orders-widget .bow-modal{width:min(680px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:22px;padding:20px;box-shadow:0 25px 70px rgba(15,23,42,.25);direction:rtl}
      #bayaa-orders-widget .bow-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      #bayaa-orders-widget .bow-close{border:0;background:#f1f5f9;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:22px}
      #bayaa-orders-widget .bow-order{border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin:10px 0}
      #bayaa-orders-widget .bow-row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #bayaa-orders-widget .bow-muted{color:#64748b;font-size:13px}
      #bayaa-orders-widget .bow-status{display:inline-block;padding:5px 9px;border-radius:999px;background:#ecfeff;color:#0f766e;font-weight:700;font-size:12px}
      #bayaa-orders-widget .bow-empty{padding:24px;text-align:center;color:#64748b}
      @media(max-width:640px){#bayaa-orders-widget{left:10px;right:10px}#bayaa-orders-widget .bow-btn{width:100%}}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'bayaa-orders-widget';
    document.body.appendChild(root);

    const session = () => { try { return JSON.parse(localStorage.getItem('bayaa-session') || 'null'); } catch { return null; } };
    const token = () => localStorage.getItem('bayaa-token');

    const renderButton = () => {
      if (!token() || !session()) { root.innerHTML = ''; return; }
      root.innerHTML = `<button class="bow-btn" type="button">📦 طلباتي</button>`;
      root.querySelector('.bow-btn').onclick = openOrders;
    };

    async function openOrders() {
      root.innerHTML = `<div class="bow-backdrop"><div class="bow-modal"><div class="bow-head"><h2 style="margin:0">طلباتي</h2><button class="bow-close" type="button">×</button></div><div class="bow-empty">جاري تحميل الطلبات...</div></div></div>`;
      root.querySelector('.bow-close').onclick = renderButton;
      root.querySelector('.bow-backdrop').onclick = e => { if (e.target === e.currentTarget) renderButton(); };
      try {
        const response = await fetch('/api/orders/mine', { headers: { Authorization: `Bearer ${token()}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'تعذر تحميل الطلبات.');
        const orders = data.orders || [];
        const body = orders.length ? orders.map(o => `
          <article class="bow-order">
            <div class="bow-row"><strong>طلب #${o.id}</strong><span class="bow-status">${o.status}</span></div>
            <div class="bow-row bow-muted" style="margin-top:8px"><span>نوع الطلب: طلب تواصل مباشر</span><span>الإجمالي: ${Number(o.total).toLocaleString('ar-MR')} MRU</span></div>
            <div class="bow-muted" style="margin-top:6px">${o.city || ''} — ${o.address || ''}</div>
          </article>`).join('') : `<div class="bow-empty">لا توجد طلبات حتى الآن.</div>`;
        root.querySelector('.bow-modal').innerHTML = `<div class="bow-head"><h2 style="margin:0">طلباتي</h2><button class="bow-close" type="button">×</button></div>${body}`;
        root.querySelector('.bow-close').onclick = renderButton;
      } catch (error) {
        root.querySelector('.bow-modal').innerHTML = `<div class="bow-head"><h2 style="margin:0">طلباتي</h2><button class="bow-close" type="button">×</button></div><div class="bow-empty">${error.message}</div>`;
        root.querySelector('.bow-close').onclick = renderButton;
      }
    }

    window.addEventListener('storage', renderButton);
    setInterval(renderButton, 1500);
    renderButton();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
