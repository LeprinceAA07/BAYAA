(() => {
  const token = () => localStorage.getItem('bayaa-token') || '';
  const session = () => { try { return JSON.parse(localStorage.getItem('bayaa-session') || 'null'); } catch { return null; } };
  const isSeller = () => session()?.role === 'seller';
  const API = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
  let paddleReady = false;

  const loadPaddle = async (environment, clientToken) => {
    if (window.Paddle) {
      if (environment === 'sandbox' && window.Paddle.Environment?.set) window.Paddle.Environment.set('sandbox');
      if (!paddleReady) { window.Paddle.Initialize({ token: clientToken }); paddleReady = true; }
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    if (environment === 'sandbox' && window.Paddle.Environment?.set) window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token: clientToken });
    paddleReady = true;
  };

  const request = async (path) => {
    const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'تعذر تحميل معلومات الاشتراك.');
    return data;
  };

  const renderButton = (root) => {
    root.innerHTML = '<button class="bbw-btn">💳 اشتراك البائع</button>';
    root.querySelector('.bbw-btn').onclick = openBilling;
  };

  const boot = () => {
    if (!isSeller() || document.getElementById('bayaa-billing-widget')) return;
    const style = document.createElement('style');
    style.textContent = `
      #bayaa-billing-widget{position:fixed;right:18px;bottom:18px;z-index:9997;font-family:inherit}
      #bayaa-billing-widget .bbw-btn{border:0;border-radius:999px;padding:12px 17px;background:#111827;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 12px 35px #0003}
      #bayaa-billing-widget .bbw-backdrop{position:fixed;inset:0;background:#0007;display:grid;place-items:center;padding:18px}
      #bayaa-billing-widget .bbw-modal{width:min(560px,100%);background:#fff;border-radius:22px;padding:22px;direction:rtl;box-shadow:0 25px 70px #0004}
      #bayaa-billing-widget .bbw-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      #bayaa-billing-widget .bbw-close{border:0;background:#f1f5f9;border-radius:10px;padding:8px 12px;cursor:pointer}
      #bayaa-billing-widget .bbw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
      #bayaa-billing-widget .bbw-plan{border:1px solid #e2e8f0;border-radius:16px;padding:16px;text-align:right;background:#fff}
      #bayaa-billing-widget .bbw-plan strong{display:block;font-size:18px;margin-bottom:6px}
      #bayaa-billing-widget .bbw-plan small{display:block;color:#64748b;line-height:1.5;margin-bottom:12px}
      #bayaa-billing-widget .bbw-plan button{width:100%;border:0;border-radius:10px;padding:10px;background:#0f766e;color:#fff;font-weight:800;cursor:pointer}
      #bayaa-billing-widget .bbw-muted{color:#64748b;font-size:13px}
      @media(max-width:640px){#bayaa-billing-widget{right:10px;left:10px}.bbw-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'bayaa-billing-widget';
    document.body.appendChild(root);

    async function openBilling() {
      root.innerHTML = '<div class="bbw-backdrop"><div class="bbw-modal"><div class="bbw-head"><h2>اشتراك البائع</h2><button class="bbw-close">×</button></div><p class="bbw-muted">جاري تحميل إعدادات الدفع...</p></div></div>';
      root.querySelector('.bbw-close').onclick = () => renderButton(root);
      try {
        const summary = await request('/api/seller/billing/summary');
        const config = await request('/api/seller/billing/paddle-config');
        const current = summary.plan || 'free';
        const openCheckout = async (plan) => {
          await loadPaddle(config.environment, config.clientToken);
          const priceId = config.plans?.[plan]?.priceId;
          if (!priceId) throw new Error('Price ID غير مضبوط لهذه الخطة.');
          window.Paddle.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customer: { email: session()?.email || undefined },
            customData: { sellerId: String(session()?.id || ''), plan },
            settings: { displayMode: 'overlay', theme: 'light', locale: 'ar' },
          });
        };
        root.querySelector('.bbw-modal').innerHTML = `
          <div class="bbw-head"><div><h2 style="margin:0">اشتراك البائع</h2><p class="bbw-muted">الخطة الحالية: <strong>${current}</strong> · العمولة: ${(Number(summary.commissionRate || 0) * 100).toFixed(0)}%</p></div><button class="bbw-close">×</button></div>
          <div class="bbw-grid">
            <div class="bbw-plan"><strong>Pro</strong><small>عمولة BAYAA: 3%<br>اشتراك شهري عبر Paddle</small><button data-plan="pro">الاشتراك الآن</button></div>
            <div class="bbw-plan"><strong>Business</strong><small>عمولة BAYAA: 2%<br>اشتراك شهري عبر Paddle</small><button data-plan="business">الاشتراك الآن</button></div>
          </div>
          <p class="bbw-muted" style="margin-top:14px">الدفع هنا خاص بالبائع فقط. المشتري لا يدفع لـBAYAA.</p>`;
        root.querySelector('.bbw-close').onclick = () => root.remove();
        root.querySelectorAll('[data-plan]').forEach((button) => button.onclick = async () => {
          button.disabled = true;
          try { await openCheckout(button.dataset.plan); } catch (error) { alert(error.message); } finally { button.disabled = false; }
        });
      } catch (error) {
        root.querySelector('.bbw-modal').innerHTML = `<div class="bbw-head"><h2>اشتراك البائع</h2><button class="bbw-close">×</button></div><p>${error.message}</p><p class="bbw-muted">أكمل إعداد Paddle Sandbox ثم أضف PADDLE_CLIENT_TOKEN وPrice IDs وWebhook Secret في Railway.</p>`;
        root.querySelector('.bbw-close').onclick = () => root.remove();
      }
    }

    renderButton(root);
  };

  const refresh = () => {
    if (isSeller() && !document.getElementById('bayaa-billing-widget')) boot();
    if (!isSeller()) document.getElementById('bayaa-billing-widget')?.remove();
  };
  window.addEventListener('storage', refresh);
  setInterval(refresh, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();
})();
