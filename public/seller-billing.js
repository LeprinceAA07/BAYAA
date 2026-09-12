(() => {
  const token = localStorage.getItem('bayaa-token');
  const status = document.getElementById('status');
  const buttons = [...document.querySelectorAll('[data-plan]')].filter((b) => b.dataset.plan !== 'free');
  const setStatus = (text) => { if (status) status.textContent = text; };

  if (!token) {
    setStatus('Connectez-vous comme vendeur pour gérer votre abonnement.');
    buttons.forEach((button) => { button.disabled = true; });
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };
  let paddlePromise = null;
  let paddleConfig = null;
  let currentProfile = null;

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/seller/billing/summary', { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger le statut.');
      setStatus(`Plan : ${String(data.plan).toUpperCase()} · Statut : ${data.subscriptionStatus} · Commission : ${(Number(data.commissionRate) * 100).toFixed(0)}%`);
    } catch (error) {
      setStatus(error.message || 'Erreur de chargement.');
    }
  };

  const loadPaddle = async () => {
    if (paddlePromise) return paddlePromise;
    paddlePromise = (async () => {
      const [configResponse, meResponse] = await Promise.all([
        fetch('/api/seller/billing/paddle-config', { headers: authHeaders }),
        fetch('/api/me', { headers: authHeaders })
      ]);
      const config = await configResponse.json();
      const me = await meResponse.json();
      if (!configResponse.ok) throw new Error(config.error || 'Paddle n’est pas encore configuré.');
      if (!meResponse.ok) throw new Error(me.error || 'Impossible de charger le profil vendeur.');
      paddleConfig = config;
      currentProfile = me?.user || null;

      if (window.Paddle?.Checkout) {
        if (config.environment === 'sandbox' && window.Paddle.Environment?.set) window.Paddle.Environment.set('sandbox');
        return config;
      }

      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-bayaa-paddle]');
        if (existing) {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', () => reject(new Error('Impossible de charger Paddle Checkout.')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.async = true;
        script.dataset.bayaaPaddle = 'true';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Impossible de charger Paddle Checkout.'));
        document.head.appendChild(script);
      });

      if (!window.Paddle?.Initialize) throw new Error('Paddle Checkout indisponible.');
      if (config.environment === 'sandbox' && window.Paddle.Environment?.set) window.Paddle.Environment.set('sandbox');
      window.Paddle.Initialize({
        token: config.clientToken,
        eventCallback: (event) => {
          if (event?.name === 'checkout.completed') {
            setStatus('Paiement reçu. Confirmation en cours…');
            setTimeout(loadStatus, 1500);
          }
        }
      });
      return config;
    })();
    try {
      return await paddlePromise;
    } catch (error) {
      paddlePromise = null;
      throw error;
    }
  };

  buttons.forEach((button) => button.addEventListener('click', async () => {
    buttons.forEach((item) => { item.disabled = true; });
    const plan = String(button.dataset.plan || '').toLowerCase();
    setStatus(`Préparation du paiement sécurisé pour le plan ${plan.toUpperCase()}…`);
    try {
      const config = paddleConfig || await loadPaddle();
      if (!currentProfile) await loadPaddle();
      const priceId = config.plans?.[plan]?.priceId;
      if (!priceId) throw new Error('Price ID manquant pour ce plan.');
      if (!window.Paddle?.Checkout?.open) throw new Error('Paddle Checkout indisponible.');

      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: currentProfile?.email ? { email: currentProfile.email } : undefined,
        customData: { sellerId: String(currentProfile?.id || ''), plan }
      });
      setStatus(`Checkout ${plan.toUpperCase()} ouvert.`);
    } catch (error) {
      setStatus(error.message || 'Erreur de paiement.');
      buttons.forEach((item) => { item.disabled = false; });
    }
  }));

  loadStatus();
})();
