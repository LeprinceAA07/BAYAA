
app.get('/api/seller/billing/summary', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS seller_billing (seller_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL DEFAULT 'free', subscription_status TEXT NOT NULL DEFAULT 'inactive', paid_until TIMESTAMPTZ, last_payment_reference TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const result = await pool.query(`SELECT plan,subscription_status,paid_until,last_payment_reference FROM seller_billing WHERE seller_id=$1`, [req.user.id]);
    const row = result.rows[0] || { plan: 'free', subscription_status: 'inactive', paid_until: null, last_payment_reference: null };
    const commissionRate = row.plan === 'business' ? 0.02 : row.plan === 'pro' ? 0.03 : 0.05;
    res.json({ currency: 'MRU', plan: row.plan, subscriptionStatus: row.subscription_status, paidUntil: row.paid_until, lastPaymentReference: row.last_payment_reference, commissionRate });
  } catch { res.status(500).json({ error: 'Could not load seller billing.' }); }
});

app.post('/api/seller/billing/checkout', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const plan = String(req.body?.plan || '').trim().toLowerCase();
  const prices = { pro: 500, business: 1500 };
  if (!Object.prototype.hasOwnProperty.call(prices, plan)) return res.status(400).json({ error: 'Choose Pro or Business.' });
  const gatewayBase = String(process.env.CARD_GATEWAY_BASE_URL || '').trim().replace(/\\/$/, '');
  const merchantId = String(process.env.CARD_GATEWAY_MERCHANT_ID || '').trim();
  const apiPassword = String(process.env.CARD_GATEWAY_API_PASSWORD || '');
  const version = String(process.env.CARD_GATEWAY_API_VERSION || '100').trim();
  const currency = String(process.env.CARD_GATEWAY_CURRENCY || 'MRU').trim().toUpperCase();
  const gatewayCheckoutTemplate = String(process.env.CARD_GATEWAY_CHECKOUT_URL || '').trim();
  if (!gatewayBase || !merchantId || !apiPassword) return res.status(503).json({ error: 'Visa/Mastercard gateway is not configured yet.' });

  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS seller_billing (seller_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL DEFAULT 'free', subscription_status TEXT NOT NULL DEFAULT 'inactive', paid_until TIMESTAMPTZ, last_payment_reference TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const orderId = `BAYAA-BILL-${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const returnUrl = String(process.env.CARD_GATEWAY_RETURN_URL || `${process.env.PUBLIC_BASE_URL || ''}/seller-billing.html`).trim();
    const payload = {
      apiOperation: 'INITIATE_CHECKOUT',
      checkoutMode: 'WEBSITE',
      interaction: {
        operation: 'PURCHASE',
        returnUrl,
        cancelUrl: returnUrl,
        merchant: { name: String(process.env.CARD_GATEWAY_MERCHANT_NAME || 'BAYAA') }
      },
      order: { id: orderId, amount: Number(prices[plan]).toFixed(2), currency }
    };
    const endpoint = `${gatewayBase}/api/rest/version/${encodeURIComponent(version)}/merchant/${encodeURIComponent(merchantId)}/session`;
    const response = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`merchant.${merchantId}:${apiPassword}`).toString('base64')}` }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.explanation || data?.error?.cause || 'Card gateway rejected the checkout request.' });
    const sessionId = data?.session?.id;
    if (!sessionId) return res.status(502).json({ error: 'Card gateway did not return a session id.' });
    await pool.query(`INSERT INTO seller_billing (seller_id,plan,subscription_status,updated_at) VALUES ($1,$2,'pending',NOW()) ON CONFLICT (seller_id) DO UPDATE SET plan=EXCLUDED.plan,subscription_status='pending',updated_at=NOW()`, [req.user.id, plan]);
    const checkoutUrl = gatewayCheckoutTemplate
      ? gatewayCheckoutTemplate.replaceAll('{sessionId}', encodeURIComponent(sessionId)).replaceAll('{version}', encodeURIComponent(version)).replaceAll('{merchantId}', encodeURIComponent(merchantId))
      : `${gatewayBase}/checkout/version/${encodeURIComponent(version)}/checkout.html?session.id=${encodeURIComponent(sessionId)}`;
    res.status(201).json({ plan, amount: prices[plan], currency, orderId, sessionId, checkoutUrl });
  } catch { res.status(502).json({ error: 'Card gateway is unavailable.' }); }
});

app.get('/api/seller/billing/verify', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const orderId = String(req.query?.orderId || '').trim();
  if (!orderId) return res.status(400).json({ error: 'orderId is required.' });
  const gatewayBase = String(process.env.CARD_GATEWAY_BASE_URL || '').trim().replace(/\\/$/, '');
  const merchantId = String(process.env.CARD_GATEWAY_MERCHANT_ID || '').trim();
  const apiPassword = String(process.env.CARD_GATEWAY_API_PASSWORD || '');
  const version = String(process.env.CARD_GATEWAY_API_VERSION || '100').trim();
  if (!gatewayBase || !merchantId || !apiPassword) return res.status(503).json({ error: 'Visa/Mastercard gateway is not configured yet.' });
  try {
    const endpoint = `${gatewayBase}/api/rest/version/${encodeURIComponent(version)}/merchant/${encodeURIComponent(merchantId)}/order/${encodeURIComponent(orderId)}`;
    const response = await fetch(endpoint, { headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`merchant.${merchantId}:${apiPassword}`).toString('base64')}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.explanation || 'Could not verify payment.' });
    const resultCode = String(data?.result || '').toUpperCase();
    const paid = resultCode === 'SUCCESS' || String(data?.order?.status || '').toUpperCase() === 'CAPTURED';
    if (paid) {
      await pool.query(`UPDATE seller_billing SET subscription_status='active',paid_until=CASE WHEN plan='business' THEN NOW()+INTERVAL '30 days' WHEN plan='pro' THEN NOW()+INTERVAL '30 days' ELSE paid_until END,last_payment_reference=$1,updated_at=NOW() WHERE seller_id=$2`, [orderId, req.user.id]);
    }
    res.json({ paid, result: resultCode, orderStatus: data?.order?.status || null });
  } catch { res.status(502).json({ error: 'Card gateway is unavailable.' }); }
});
