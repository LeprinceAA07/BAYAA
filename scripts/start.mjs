import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../server.js', import.meta.url), 'utf8');
const productMarker = "app.delete('/api/products/:id', auth, sellerOnly, async (req, res) => {";
const productPatch = `app.patch('/api/products/:id', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const { title, description, category, price, imageUrl } = req.body || {};
  const updates = [];
  const values = [];
  let paramCount = 1;
  if (title !== undefined) {
    const trimmed = String(title).trim();
    if (!trimmed) return res.status(400).json({ error: 'Title cannot be empty.' });
    updates.push(\`title = $\${paramCount++}\`); values.push(trimmed);
  }
  if (description !== undefined) { updates.push(\`description = $\${paramCount++}\`); values.push(String(description).trim()); }
  if (category !== undefined) {
    const trimmed = String(category).trim();
    if (!trimmed) return res.status(400).json({ error: 'Category cannot be empty.' });
    updates.push(\`category = $\${paramCount++}\`); values.push(trimmed);
  }
  if (price !== undefined) {
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return res.status(400).json({ error: 'Price must be a positive number.' });
    updates.push(\`price = $\${paramCount++}\`); values.push(numericPrice);
  }
  if (imageUrl !== undefined) { updates.push(\`image_url = $\${paramCount++}\`); values.push(String(imageUrl).trim()); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
  values.push(req.params.id, req.user.id);
  try {
    const result = await pool.query(\`UPDATE products SET \${updates.join(', ')} WHERE id = $\${paramCount++} AND seller_id = $\${paramCount++} RETURNING id,seller_id,title,description,category,price,image_url,active,created_at\`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not update product.' }); }
});

`;

const contactMigration = "app.get('/api/health', async (_req, res) => {";
const contactPatch = `app.patch('/api/me/contact', auth, async (req, res) => {
  if (!requireDb(res)) return;
  const contactPhone = String(req.body?.contactPhone || '').trim();
  const digits = contactPhone.replace(/\\D/g, '');
  if (!/^\\d{8,15}$/.test(digits)) return res.status(400).json({ error: 'Enter a valid contact phone number.' });
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_phone TEXT');
    const result = await pool.query('UPDATE users SET contact_phone=$1 WHERE id=$2 RETURNING id,name,email,role,contact_phone', [digits, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not save contact phone.' }); }
});

`;

const productContactQuery = "SELECT id,seller_id,title,description,category,price,image_url,created_at FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC";
const productContactQueryPatched = "SELECT p.id,p.seller_id,p.title,p.description,p.category,p.price,p.image_url,p.created_at,u.contact_phone AS seller_phone FROM products p LEFT JOIN users u ON u.id=p.seller_id WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC";

const webhookInsertMarker = "app.use(express.json({ limit: '1mb' }));";
const webhookPatch = `app.post('/api/webhooks/moosyl', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const secret = process.env.MOOSYL_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Payment webhook is not configured.' });
  const signature = String(req.headers['x-webhook-signature'] || '');
  const eventHeader = String(req.headers['x-webhook-event'] || '');
  if (!signature.startsWith('sha256=')) return res.status(401).json({ error: 'Invalid signature.' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
  const crypto = await import('node:crypto');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const received = signature.slice(7);
  let valid = false;
  try { const a = Buffer.from(received, 'hex'); const b = Buffer.from(expected, 'hex'); valid = a.length === b.length && crypto.timingSafeEqual(a, b); } catch { valid = false; }
  if (!valid) return res.status(401).json({ error: 'Invalid signature.' });
  let payload; try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
  const event = String(payload?.event || eventHeader);
  const data = payload?.data || {};
  const allowed = new Set(['payment-created','payment-updated','payment-request-created','payment-request-updated']);
  if (!allowed.has(event)) return res.status(400).json({ error: 'Unsupported event.' });
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL is not configured.' });
  const transactionId = String(data?.transactionId || data?.request?.transactionId || '').trim();
  if (!transactionId) return res.json({ received: true, ignored: true });
  const status = String(data?.status || data?.request?.status || '').toLowerCase();
  const paymentStatus = ['completed','paid','success','succeeded'].includes(status) ? 'paid' : ['failed','cancelled','canceled','expired'].includes(status) ? 'failed' : 'pending';
  const reference = String(data?.referenceId || '').trim() || null;
  try {
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT');
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'");
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT');
    await pool.query('UPDATE orders SET payment_status=$1,payment_reference=COALESCE($2,payment_reference) WHERE payment_transaction_id=$3', [paymentStatus, reference, transactionId]);
    return res.json({ received: true });
  } catch { return res.status(500).json({ error: 'Webhook processing failed.' }); }
});

`;

const checkoutMarker = "app.post('/api/payments/create', auth, async (req, res) => {";
const checkoutPatch = `app.post('/api/payments/checkout', auth, async (req, res) => {
  if (!process.env.MOOSYL_SECRET_KEY) return res.status(503).json({ error: 'Payment provider is not configured yet.' });
  const amount = Number(req.body?.amount);
  const transactionId = String(req.body?.transactionId || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !transactionId) return res.status(400).json({ error: 'Invalid payment data.' });
  try {
    const requestResponse = await fetch('https://api.moosyl.com/payment-request', {
      method: 'POST', headers: { Authorization: process.env.MOOSYL_SECRET_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, transactionId }),
    });
    let requestData = await requestResponse.json().catch(() => ({}));
    if (!requestResponse.ok) {
      const lookup = await fetch(\`https://api.moosyl.com/payment-request/transaction/\${encodeURIComponent(transactionId)}\`, { headers: { Authorization: process.env.MOOSYL_SECRET_KEY } });
      if (lookup.ok) requestData = await lookup.json().catch(() => ({}));
      else return res.status(requestResponse.status).json({ error: requestData?.error || 'Payment request failed.' });
    }
    const paymentRequestId = requestData?.data?.id || requestData?.id || requestData?.paymentRequestId;
    if (!paymentRequestId) return res.status(502).json({ error: 'Moosyl did not return a payment request ID.' });
    const checkoutResponse = await fetch('https://api.moosyl.com/checkout-session', {
      method: 'POST', headers: { Authorization: process.env.MOOSYL_SECRET_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentRequestId }),
    });
    const checkoutData = await checkoutResponse.json().catch(() => ({}));
    if (!checkoutResponse.ok) return res.status(checkoutResponse.status).json({ error: checkoutData?.error || 'Checkout session creation failed.' });
    const checkoutUrl = checkoutData?.checkoutUrl || checkoutData?.data?.checkoutUrl || checkoutData?.url;
    if (!checkoutUrl) return res.status(502).json({ error: 'Moosyl did not return a checkout URL.' });
    res.status(201).json({ transactionId, paymentRequestId, checkoutUrl });
  } catch { res.status(502).json({ error: 'Payment provider is unavailable.' }); }
});

`;

const orderPaymentMarker = "app.post('/api/orders', auth, async (req, res) => {";
const orderPaymentPatch = `app.post('/api/orders', auth, async (req, res) => {
  if (!requireDb(res)) return;
  const { customerName, phone, city, address, items, total, paymentMethod = 'cod' } = req.body || {};
  const allowedPaymentMethods = new Set(['card']);
  if (!customerName?.trim() || !phone?.trim() || !city?.trim() || !address?.trim() || !Array.isArray(items) || !items.length || !Number.isFinite(Number(total)) || !allowedPaymentMethods.has(paymentMethod)) return res.status(400).json({ error: 'Only Visa/Mastercard card payments are supported.' });
  const paymentTransactionId = \`BAYAA-\${Date.now()}-\${Math.random().toString(36).slice(2,10)}\`;
  try {
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT');
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'");
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT');
    const result = await pool.query('INSERT INTO orders (buyer_id,customer_name,phone,city,address,total,status,payment_method,payment_transaction_id,payment_status,items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,status,payment_method,payment_transaction_id,payment_status,total,created_at', [req.user.id, customerName.trim(), phone.trim(), city.trim(), address.trim(), Number(total), 'بانتظار الدفع', 'card', paymentTransactionId, 'pending', JSON.stringify(items)]);
    res.status(201).json({ order: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not create order.' }); }
});

`;

const patched = source
  .replace(productMarker, (source.includes("app.patch('/api/products/:id'") ? '' : productPatch) + productMarker)
  .replace(contactMigration, contactPatch + contactMigration)
  .replace(productContactQuery, productContactQueryPatched)
  .replace(webhookInsertMarker, webhookPatch + webhookInsertMarker)
  .replace(orderPaymentMarker, (source.includes('payment_transaction_id') ? '' : orderPaymentPatch) + orderPaymentMarker)
  .replace(checkoutMarker, (source.includes("app.post('/api/payments/checkout'") ? '' : checkoutPatch) + checkoutMarker);
const temp = new URL('../.bayaa-runtime-server.mjs', import.meta.url);
await fs.writeFile(temp, patched, 'utf8');
await import(`${temp.href}?v=${Date.now()}`);
