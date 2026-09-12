(() => {
  const token = localStorage.getItem('bayaa-token');
  const status = document.getElementById('status');
  const buttons = [...document.querySelectorAll('[data-plan]')].filter(b => b.dataset.plan !== 'free');

  const setStatus = (text) => { if (status) status.textContent = text; };

  if (!token) {
    setStatus('Connectez-vous comme vendeur pour gérer votre abonnement.');
    buttons.forEach(button => { button.disabled = true; });
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

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

  const initPaddle = async () => {
    const response = await fetch('/api/seller/billing/paddle-config', { headers: authHeaders });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Paddle n’est pas encore configuré.');

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    document.head.appendChild(script);
    await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('Impossible de charger Paddle Checkout.')); });

    if (config.environment === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token: config.clientToken });
    return config;
  };

  buttons.forEach(button => button.addEventListener('click', async () => {
    buttons.forEach(item => { item.disabled = true; });
    setStatus('Ouverture du paiement sécurisé Visa / Mastercard / cartes prépayées…');
    try {
      const [configResponse, meResponse] = await Promise.all([
        fetch('/api/seller/billing/paddle-config', { headers: authHeaders }),
        fetch('/api/me', { headers: authHeaders })
      ]);
      const config = await configResponse.json();
      const me = await meResponse.json();
      if (!configResponse.ok) throw new Error(config.error || 'Paddle n’est pas encore configuré.');
      if (!meResponse.ok) throw new Error(me.error || 'Impossible de charger le profil vendeur.');

      const script = document.createElement('script');
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.async = true;
      document.head.appendChild(script);
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('Impossible de charger Paddle Checkout.')); });
      if (config.environment === 'sandbox') window.Paddle.Environment.set('sandbox');

      const plan = button.dataset.plan;
      const priceId = config.plans?.[plan]?.priceId;
      if (!priceId) throw new Error('Price ID manquant pour ce plan.');

      window.Paddle.Initialize({
        token: config.clientToken,
        eventCallback: (event) => {
          if (event?.name === 'checkout.completed') {
            setStatus('Paiement reçu. Confirmation en cours…');
            setTimeout(loadStatus, 1500);
          }
        }
      });

      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: me?.user?.email },
        customData: { sellerId: String(me?.user?.id || ''), plan }
      });
      setStatus(`Checkout ${plan.toUpperCase()} ouvert.`);
    } catch (error) {
      setStatus(error.message || 'Erreur de paiement.');
      buttons.forEach(item => { item.disabled = false; });
    }
  }));

  loadStatus();
})();
