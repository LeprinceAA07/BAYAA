
app.get('/api/seller/billing/summary', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS seller_billing (seller_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL DEFAULT 'free', subscription_status TEXT NOT NULL DEFAULT 'inactive', paid_until TIMESTAMPTZ, paddle_customer_id TEXT, paddle_subscription_id TEXT, last_payment_reference TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const result = await pool.query(`SELECT plan,subscription_status,paid_until,paddle_customer_id,paddle_subscription_id,last_payment_reference FROM seller_billing WHERE seller_id=$1`, [req.user.id]);
    const row = result.rows[0] || { plan: 'free', subscription_status: 'inactive', paid_until: null, paddle_customer_id: null, paddle_subscription_id: null, last_payment_reference: null };
    const commissionRate = row.plan === 'business' ? 0.02 : row.plan === 'pro' ? 0.03 : 0.05;
    res.json({ currency: 'MRU', plan: row.plan, subscriptionStatus: row.subscription_status, paidUntil: row.paid_until, paddleCustomerId: row.paddle_customer_id, paddleSubscriptionId: row.paddle_subscription_id, lastPaymentReference: row.last_payment_reference, commissionRate, paymentProvider: 'paddle' });
  } catch { res.status(500).json({ error: 'Could not load seller billing.' }); }
});

app.get('/api/seller/billing/paddle-config', auth, sellerOnly, async (_req, res) => {
  const clientToken = String(process.env.PADDLE_CLIENT_TOKEN || '').trim();
  const proPriceId = String(process.env.PADDLE_PRO_PRICE_ID || '').trim();
  const businessPriceId = String(process.env.PADDLE_BUSINESS_PRICE_ID || '').trim();
  if (!clientToken || !proPriceId || !businessPriceId) return res.status(503).json({ error: 'Paddle billing is not configured yet.' });
  res.json({ environment: String(process.env.PADDLE_ENVIRONMENT || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox', clientToken, plans: { pro: { priceId: proPriceId }, business: { priceId: businessPriceId } } });
});

app.post('/api/webhooks/paddle', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const secret = String(process.env.PADDLE_WEBHOOK_SECRET || '').trim();
  const signature = String(req.headers['paddle-signature'] || '').trim();
  if (!secret || !signature) return res.status(503).json({ error: 'Paddle webhook is not configured.' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
  const parts = Object.fromEntries(signature.split(';').map(part => { const i = part.indexOf('='); return i > 0 ? [part.slice(0, i), part.slice(i + 1)] : [part, '']; }));
  const ts = Number(parts.ts);
  const h1 = String(parts.h1 || '').trim();
  if (!Number.isFinite(ts) || !/^[a-f0-9]{64}$/i.test(h1)) return res.status(401).json({ error: 'Invalid Paddle signature.' });
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return res.status(401).json({ error: 'Expired Paddle signature.' });
  const expected = crypto.createHmac('sha256', secret).update(`${ts}:${raw.toString('utf8')}`).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(h1, 'hex'), Buffer.from(expected, 'hex'))) return res.status(401).json({ error: 'Invalid Paddle signature.' });
  let payload; try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON payload.' }); }
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL is not configured.' });
  const eventId = String(payload?.event_id || '').trim();
  const eventType = String(payload?.event_type || '').trim();
  const occurredAt = String(payload?.occurred_at || '').trim();
  const data = payload?.data || {};
  const customData = data?.custom_data || {};
  const sellerId = String(customData?.sellerId || customData?.seller_id || '').trim();
  if (!eventId || !eventType) return res.status(400).json({ error: 'Invalid Paddle event.' });
  if (!sellerId) return res.status(200).json({ received: true, ignored: true });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS seller_billing (seller_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL DEFAULT 'free', subscription_status TEXT NOT NULL DEFAULT 'inactive', paid_until TIMESTAMPTZ, paddle_customer_id TEXT, paddle_subscription_id TEXT, last_payment_reference TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS paddle_webhook_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, occurred_at TIMESTAMPTZ, seller_id BIGINT, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const insertedEvent = await client.query(`INSERT INTO paddle_webhook_events (event_id,event_type,occurred_at,seller_id) VALUES ($1,$2,$3,$4) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`, [eventId, eventType, occurredAt || null, sellerId]);
    if (!insertedEvent.rowCount) {
      await client.query('COMMIT');
      return res.status(200).json({ received: true, duplicate: true });
    }

    let plan = String(customData?.plan || '').toLowerCase();
    if (!['pro','business'].includes(plan)) {
      const priceId = String(data?.items?.[0]?.price?.id || data?.items?.[0]?.price_id || '').trim();
      if (priceId && priceId === String(process.env.PADDLE_BUSINESS_PRICE_ID || '').trim()) plan = 'business';
      else if (priceId && priceId === String(process.env.PADDLE_PRO_PRICE_ID || '').trim()) plan = 'pro';
    }
    if (eventType === 'transaction.completed') {
      await client.query(`UPDATE seller_billing SET plan=CASE WHEN $1 IN ('pro','business') THEN $1 ELSE plan END,subscription_status='active',paid_until=NOW()+INTERVAL '30 days',paddle_customer_id=COALESCE($2,paddle_customer_id),paddle_subscription_id=COALESCE($3,paddle_subscription_id),last_payment_reference=COALESCE($4,last_payment_reference),updated_at=NOW() WHERE seller_id=$5`, [plan, String(data?.customer_id || '').trim() || null, String(data?.subscription_id || '').trim() || null, String(data?.id || '').trim() || null, sellerId]);
    } else if (['subscription.created','subscription.updated'].includes(eventType)) {
      const status = String(data?.status || '').toLowerCase();
      const active = ['active','trialing'].includes(status);
      await client.query(`UPDATE seller_billing SET plan=CASE WHEN $1 IN ('pro','business') THEN $1 ELSE plan END,subscription_status=$2,paid_until=CASE WHEN $2='active' THEN COALESCE($3::timestamptz,NOW()+INTERVAL '30 days') ELSE paid_until END,paddle_customer_id=COALESCE($4,paddle_customer_id),paddle_subscription_id=COALESCE($5,paddle_subscription_id),updated_at=NOW() WHERE seller_id=$6`, [plan, active ? 'active' : (status || 'inactive'), data?.next_billed_at || null, String(data?.customer_id || '').trim() || null, String(data?.id || '').trim() || null, sellerId]);
    } else if (eventType === 'subscription.canceled') {
      await client.query(`UPDATE seller_billing SET subscription_status='canceled',paddle_customer_id=COALESCE($1,paddle_customer_id),paddle_subscription_id=COALESCE($2,paddle_subscription_id),updated_at=NOW() WHERE seller_id=$3`, [String(data?.customer_id || '').trim() || null, String(data?.id || '').trim() || null, sellerId]);
    }
    await client.query('COMMIT');
    res.status(200).json({ received: true });
  } catch {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Paddle webhook processing failed.' });
  } finally {
    client.release();
  }
});

app.post('/api/seller/billing/report-sale', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Sale amount must be positive.' });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS seller_commission_ledger (id BIGSERIAL PRIMARY KEY, seller_id BIGINT REFERENCES users(id) ON DELETE CASCADE, sale_amount NUMERIC(12,2) NOT NULL, rate NUMERIC(6,4) NOT NULL, commission_amount NUMERIC(12,2) NOT NULL, status TEXT NOT NULL DEFAULT 'unpaid', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const summary = await pool.query(`SELECT plan FROM seller_billing WHERE seller_id=$1`, [req.user.id]);
    const plan = String(summary.rows[0]?.plan || 'free');
    const rate = plan === 'business' ? 0.02 : plan === 'pro' ? 0.03 : 0.05;
    const inserted = await pool.query(`INSERT INTO seller_commission_ledger (seller_id,sale_amount,rate,commission_amount) VALUES ($1,$2,$3,$4) RETURNING id,sale_amount,rate,commission_amount,status,created_at`, [req.user.id, amount, rate, amount * rate]);
    res.status(201).json({ commission: inserted.rows[0] });
  } catch { res.status(500).json({ error: 'Could not record commission.' }); }
});
