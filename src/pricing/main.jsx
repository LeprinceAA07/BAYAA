import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializePaddle } from '@paddle/paddle-js';
import './styles.css';

/** @typedef {{name:'Starter'|'Pro'|'Advanced',description:string,features:string[],priceId:{month:string,year:string}}} Tier */
const tiers = [
  { name: 'Starter', description: 'للبائعين الذين يبدأون البيع مع BAYAA.', features: ['إضافة المنتجات', 'لوحة بائع أساسية', 'تواصل مباشر مع المشترين'], priceId: { month: import.meta.env.VITE_PADDLE_STARTER_MONTH_PRICE_ID || '', year: import.meta.env.VITE_PADDLE_STARTER_YEAR_PRICE_ID || '' } },
  { name: 'Pro', description: 'للبائعين النشطين الذين يريدون تكلفة عمولة أقل.', features: ['كل مزايا Starter', 'عمولة مخفضة', 'أولوية في أدوات البائع'], priceId: { month: import.meta.env.VITE_PADDLE_PRO_MONTH_PRICE_ID || '', year: import.meta.env.VITE_PADDLE_PRO_YEAR_PRICE_ID || '' } },
  { name: 'Advanced', description: 'للبائعين ذوي حجم المبيعات المرتفع.', features: ['كل مزايا Pro', 'أقل عمولة', 'أولوية للدعم'], priceId: { month: import.meta.env.VITE_PADDLE_ADVANCED_MONTH_PRICE_ID || '', year: import.meta.env.VITE_PADDLE_ADVANCED_YEAR_PRICE_ID || '' } },
];

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

function PricingPage({ countryCode, signedInEmail }) {
  const [billing, setBilling] = useState('month');
  const [paddle, setPaddle] = useState(null);
  const [prices, setPrices] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const selected = useMemo(() => tiers.map((tier) => ({ ...tier, selectedPriceId: tier.priceId[billing] })), [billing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const environment = String(import.meta.env.VITE_PADDLE_ENVIRONMENT || '').trim().toLowerCase();
        const token = String(import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '').trim();
        if (!environment) throw new Error('Paddle environment is not configured.');
        if (environment !== 'sandbox') throw new Error('This pricing page is configured for Paddle Sandbox only.');
        if (!token.startsWith('test_')) throw new Error('A Paddle Sandbox client-side token starting with test_ is required.');
        const instance = await initializePaddle({ token });
        if (!instance) throw new Error('Paddle failed to initialize.');
        if (cancelled) return;
        setPaddle(instance);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not initialize Paddle.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = selected.map((tier) => tier.selectedPriceId).filter(Boolean);
    const missing = selected.filter((tier) => !tier.selectedPriceId).map((tier) => `${tier.name} ${billing}`);
    if (missing.length) {
      setError(`Missing Paddle price IDs: ${missing.join(', ')}`);
      setLoading(false);
      return undefined;
    }
    if (!paddle || !ids.length) return undefined;
    setLoading(true);
    (async () => {
      try {
        const request = { items: ids.map((priceId) => ({ priceId, quantity: 1 })) };
        if (countryCode) request.address = { countryCode };
        const result = await paddle.PricePreview(request);
        if (cancelled) return;
        const map = {};
        for (const line of result?.data?.details?.lineItems || []) {
          map[line.price.id] = line.formattedTotals;
        }
        setPrices(map);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load localized prices.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paddle, billing, countryCode, selected]);

  const subscribe = (tier) => {
    if (!paddle) return;
    const priceId = tier.priceId[billing];
    const formatted = prices[priceId];
    if (!priceId || !formatted) return;
    const checkout = {
      items: [{ priceId, quantity: 1 }],
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        successUrl: `${window.location.origin}/welcome`,
      },
    };
    if (signedInEmail) checkout.customer = { email: signedInEmail };
    paddle.Checkout.open(checkout);
  };

  return <main className="pricing-shell">
    <div className="pricing-container">
      <div className="pricing-hero">
        <span className="eyebrow">BAYAA SELLER PLANS</span>
        <h1>اختر خطة البائع المناسبة لك</h1>
        <p>أسعار محلية تُحسب من Paddle حسب بلدك، مع دفع آمن داخل Checkout.</p>
        <div className="billing-toggle" role="group" aria-label="Billing period">
          <button className={billing === 'month' ? 'active' : ''} onClick={() => setBilling('month')}>شهري</button>
          <button className={billing === 'year' ? 'active' : ''} onClick={() => setBilling('year')}>سنوي</button>
        </div>
        {countryCode && <div className="country-note">Country detected: {escapeHtml(countryCode)}</div>}
      </div>

      {error && <div className="error-banner">{escapeHtml(error)}</div>}
      <section className="pricing-grid">
        {selected.map((tier, index) => {
          const price = prices[tier.selectedPriceId];
          return <article className={`price-card ${index === 1 ? 'featured' : ''}`} key={tier.name}>
            {index === 1 && <span className="featured-badge">الأكثر طلبًا</span>}
            <h2>{tier.name}</h2>
            <p className="description">{tier.description}</p>
            <div className="price-value">{loading ? '...' : price?.total || 'غير متاح'}</div>
            <div className="billing-label">{billing === 'month' ? 'شهريًا' : 'سنويًا'}</div>
            <ul>{tier.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
            <button className="subscribe" disabled={!paddle || !price || loading} onClick={() => subscribe(tier)}>Subscribe</button>
          </article>;
        })}
      </section>
      <p className="sandbox-note">Paddle Sandbox • الأسعار المعروضة هي totals المرسلة من Paddle مباشرة، بدون حساب أو إعادة تنسيق على الواجهة.</p>
    </div>
  </main>;
}

fetch('/api/pricing-context').then((response) => response.json()).then(({ countryCode, email }) => {
  createRoot(document.getElementById('pricing-root')).render(<PricingPage countryCode={countryCode || undefined} signedInEmail={email || undefined} />);
}).catch(() => {
  createRoot(document.getElementById('pricing-root')).render(<PricingPage signedInEmail={undefined} />);
});
