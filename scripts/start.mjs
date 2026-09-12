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

const webhookInsertMarker = "app.use(express.json({ limit: '1mb' }));";
const webhookPatch = `app.post('/api/webhooks/moosyl', require('express').raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const secret = process.env.MOOSYL_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Payment webhook is not configured.' });
  const signature = String(req.headers['x-webhook-signature'] || '');
  const eventHeader = String(req.headers['x-webhook-event'] || '');
  if (!signature.startsWith('sha256=')) return res.status(401).json({ error: 'Invalid signature.' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
  const expected = require('node:crypto').createHmac('sha256', secret).update(raw).digest('hex');
  const received = signature.slice(7);
  let valid = false;
  try {
    const a = Buffer.from(received, 'hex');
    const b = Buffer.from(expected, 'hex');
    valid = a.length === b.length && require('node:crypto').timingSafeEqual(a, b);
  } catch { valid = false; }
  if (!valid) return res.status(401).json({ error: 'Invalid signature.' });
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON.' }); }
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
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT \'pending\'');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT');
    await pool.query('UPDATE orders SET payment_status=$1,payment_reference=COALESCE($2,payment_reference) WHERE payment_transaction_id=$3', [paymentStatus, reference, transactionId]);
    return res.json({ received: true });
  } catch {
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

`;

const patched = source
  .replace(productMarker, (source.includes("app.patch('/api/products/:id'") ? '' : productPatch) + productMarker)
  .replace(webhookInsertMarker, webhookPatch + webhookInsertMarker);
const temp = new URL('../.bayaa-runtime-server.mjs', import.meta.url);
await fs.writeFile(temp, patched, 'utf8');
await import(`${temp.href}?v=${Date.now()}`);
