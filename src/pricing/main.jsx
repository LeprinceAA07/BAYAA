import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializePaddle } from '@paddle/paddle-js';
import './styles.css';

const emptyPlans = {
  Starter: { month: '', year: '' },
  Pro: { month: '', year: '' },
  Advanced: { month: '', year: '' },
};

const tierMeta = [
  { name: 'Starter', description: 'للبائعين الذين يبدأون البيع مع BAYAA.', features: ['إضافة المنتجات', 'لوحة بائع أساسية', 'تواصل مباشر مع المشترين'] },
  { name: 'Pro', description: 'للبائعين النشطين الذين يريدون تكلفة عمولة أقل.', features: ['كل مزايا Starter', 'عمولة مخفضة', 'أولوية في أدوات البائع'] },
  { name: 'Advanced', description: 'للبائعين ذوي حجم المبيعات المرتفع.', features: ['كل مزايا Pro', 'أقل عمولة', 'أولوية للدعم'] },
];

function PricingPage({ config, countryCode, signedInEmail }) {
  const [billing, setBilling] = useState('month');
  const [paddle, setPaddle] = useState(null);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const plans = config?.priceIds || emptyPlans;
  const token = String(config?.clientToken || '').trim();
  const configuredEnvironment = String(config?.environment || '').trim().toLowerCase();
  const environment = token.startsWith('live_') ? 'production' : token.startsWith('test_') ? 'sandbox' : configuredEnvironment;
  const tiers = useMemo(() => tierMeta.map((tier) => ({ ...tier, priceId: plans[tier.name] || { month: '', year: '' } })), [plans]);
  const selected = useMemo(() => tiers.map((tier) => ({ ...tier, selectedPriceId: tier.priceId[billing] })), [billing, tiers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!environment) throw new Error('Paddle environment is not configured on BAYAA.');
        if (!['sandbox', 'production'].includes(environment)) throw new Error('Invalid Paddle environment.');
        if (!token.startsWith('live_') && !token.startsWith('test_')) throw new Error('The BAYAA Paddle client token is missing or invalid.');
        const instance = await initializePaddle({ environment, token });
        if (!instance) throw new Error('Paddle failed to initialize.');
        if (!cancelled) setPaddle(instance);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not initialize Paddle.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [environment, token]);

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(selected.map((tier) => tier.selectedPriceId).filter(Boolean))];
    const missing = selected.filter((tier) => !tier.selectedPriceId).map((tier) => `${tier.name} ${billing}`);
    if (missing.length) {
      setError(`Missing Paddle price IDs: ${missing.join(', ')}`);
      setPrices({});
      setLoading(false);
      return undefined;
    }
    if (!paddle || !ids.length) return undefined;
    setLoading(true);
    (async () => {
      try {
        const request = { items: ids.map((priceId) => ({ priceId, quantity: 1 })) };
        if (/^[A-Z]{2}$/.test(String(countryCode || ''))) request.address = { countryCode };
        const result = await paddle.PricePreview(request);
        if (cancelled) return;
        const map = {};
        for (const line of result?.data?.details?.lineItems || []) {
          const id = line?.price?.id;
          const total = line?.formattedTotals?.total;
          if (id && typeof total === 'string' && total.trim()) map[id] = total;
        }
        if (Object.keys(map).length !== ids.length) {
          throw new Error('Paddle did not return totals for all configured prices. Check the Live price IDs and catalog.');
        }
        setPrices(map);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load localized prices from Paddle.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paddle, billing, countryCode, selected]);

  const subscribe = (tier) => {
    if (!paddle) return;
    const priceId = tier.priceId[billing];
    const formattedTotal = prices[priceId];
    if (!priceId || typeof formattedTotal !== 'string') return;
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        successUrl: `${window.location.origin}/welcome`,
      },
      ...(signedInEmail ? { customer: { email: signedInEmail } } : {}),
    });
  };

  return (
    <main className="pricing-shell">
      <div className="pricing-container">
        <div className="pricing-hero">
          <span className="eyebrow">BAYAA SELLER PLANS</span>
          <h1>اختر خطة البائع المناسبة لك</h1>
          <p>الأسعار تُحسب مباشرة من Paddle حسب بلدك، بدون حساب يدوي على BAYAA.</p>
          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button type="button" className={billing === 'month' ? 'active' : ''} onClick={() => setBilling('month')}>شهري</button>
            <button type="button" className={billing === 'year' ? 'active' : ''} onClick={() => setBilling('year')}>سنوي</button>
          </div>
          {countryCode && <div className="country-note">البلد المكتشف: {countryCode}</div>}
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <section className="pricing-grid">
          {selected.map((tier, index) => {
            const formattedTotal = prices[tier.selectedPriceId];
            return (
              <article className={`price-card ${index === 1 ? 'featured' : ''}`} key={tier.name}>
                {index === 1 && <span className="featured-badge">الأكثر طلبًا</span>}
                <h2>{tier.name}</h2>
                <p className="description">{tier.description}</p>
                <div className="price-value">{loading ? '...' : formattedTotal || 'غير متاح'}</div>
                <div className="billing-label">{billing === 'month' ? 'شهريًا' : 'سنويًا'}</div>
                <ul>{tier.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
                <button type="button" className="subscribe" disabled={!paddle || !formattedTotal || loading} onClick={() => subscribe(tier)}>Subscribe</button>
              </article>
            );
          })}
        </section>
        <p className="sandbox-note">Paddle • الأسعار المعروضة هي totals التي يعيدها Paddle مباشرة.</p>
      </div>
    </main>
  );
}

const decodeSignedInEmail = (jwt) => {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    const email = String(decoded?.email || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
  } catch {
    return undefined;
  }
};

const token = localStorage.getItem('bayaa-token');
const signedInEmail = decodeSignedInEmail(token || '');

fetch('/api/pricing-context', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Pricing context unavailable (${response.status}).`)))
  .then((config) => createRoot(document.getElementById('pricing-root')).render(
    <PricingPage
      config={config}
      countryCode={config.countryCode || undefined}
      signedInEmail={signedInEmail || config.email || undefined}
    />
  ))
  .catch(() => createRoot(document.getElementById('pricing-root')).render(
    <PricingPage config={null} countryCode={undefined} signedInEmail={signedInEmail} />
  ));
