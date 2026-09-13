import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim()) : true }));

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } })
  : null;

const requireDb = (res) => {
  if (!pool) {
    res.status(503).json({ error: 'DATABASE_URL is not configured.' });
    return false;
  }
  return true;
};

const parsePaddleSignature = (header) => {
  const value = String(header || '').trim();
  const parts = value.split(';').map(part => part.trim()).filter(Boolean);
  const ts = parts.find(part => part.startsWith('ts='))?.slice(3) || '';
  const h1 = parts.find(part => part.startsWith('h1='))?.slice(3) || '';
  return { ts, h1 };
};

const webhookSignatureIsValid = (payload, signature, secret) => {
  if (!secret || !payload || !signature) return false;
  const { ts, h1 } = parsePaddleSignature(signature);
  if (!/^\d+$/.test(ts) || !/^[a-f0-9]{64}$/i.test(h1)) return false;
  const timestamp = Number(ts);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5) return false;
  const signedPayload = `${ts}:${Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(h1, 'hex'), Buffer.from(expected, 'hex'));
};

app.post('/api/webhooks/paddle', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Paddle webhook secret is not configured.' });
  if (!webhookSignatureIsValid(req.body, req.headers['paddle-signature'], secret)) {
    return res.status(401).json({ error: 'Invalid Paddle webhook signature.' });
  }
  if (!requireDb(res)) return;
  let envelope;
  try { envelope = JSON.parse(req.body.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON payload.' }); }
  const event = String(envelope?.event_type || envelope?.event || '').trim();
  const data = envelope?.data || {};
  const transactionId = String(data?.id || data?.transaction_id || data?.transactionId || '').trim();
  const occurredAt = envelope?.occurred_at || null;
  const allowedEvents = new Set(['transaction.created', 'transaction.updated', 'transaction.paid', 'transaction.completed', 'subscription.created', 'subscription.updated', 'subscription.canceled']);
  if (event && !allowedEvents.has(event)) return res.status(200).json({ received: true, ignored: true, event });
  try {
    if (transactionId) {
      const statusRaw = String(data?.status || '').toLowerCase();
      const paymentStatus = ['completed', 'paid', 'success', 'succeeded'].includes(statusRaw)
        ? 'completed'
        : ['failed', 'canceled', 'cancelled', 'past_due'].includes(statusRaw)
          ? 'failed'
          : (statusRaw || 'pending');
      const referenceId = String(data?.invoice_id || data?.reference_id || data?.referenceId || '').trim() || null;
      const result = await pool.query(
        `UPDATE orders SET payment_status=$1,payment_reference=COALESCE($2,payment_reference),status=CASE WHEN $1='completed' THEN 'جديد' ELSE status END WHERE transaction_id=$3 RETURNING id,status,payment_status,payment_reference`,
        [paymentStatus, referenceId, transactionId]
      );
      return res.status(200).json({ received: true, matched: Boolean(result.rowCount), event, occurredAt });
    }
    return res.status(200).json({ received: true, matched: false, event, occurredAt });
  } catch {
    return res.status(500).json({ error: 'Could not process Paddle webhook.' });
  }
});

app.use(express.json({ limit: '1mb' }));

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token.' }); }
};

const sellerOnly = (req, res, next) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Seller account required.' });
  next();
};

const adminOnly = (req, res, next) => {
  const configured = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!configured || String(req.user.email || '').toLowerCase() !== configured) return res.status(403).json({ error: 'Admin access required.' });
  next();
};

const initDb = async () => {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('buyer','seller')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      seller_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
      image_url TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      buyer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      total NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'جديد',
      payment_method TEXT NOT NULL DEFAULT 'card',
      transaction_id TEXT UNIQUE,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_reference TEXT,
      items JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'card';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='transaction_id') THEN
        ALTER TABLE orders ADD COLUMN transaction_id TEXT UNIQUE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_status') THEN
        ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_reference') THEN
        ALTER TABLE orders ADD COLUMN payment_reference TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='contact_phone') THEN
        ALTER TABLE users ADD COLUMN contact_phone TEXT;
      END IF;
    END $$;
  `);
};

app.get('/api/health', async (_req, res) => {
  if (!pool) return res.json({ ok: true, database: false, message: 'API online; DATABASE_URL missing.' });
  try { await pool.query('SELECT 1'); res.json({ ok: true, database: true }); }
  catch { res.status(503).json({ ok: false, database: false }); }
});

app.post('/api/auth/register', async (req, res) => {
  if (!requireDb(res)) return;
  const { name, email, password, role = 'buyer' } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || !['buyer','seller'].includes(role)) return res.status(400).json({ error: 'Invalid registration data.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,contact_phone', [name.trim(), email.trim().toLowerCase(), hash, role]);
    const user = result.rows[0];
    const token = jwt.sign({ id: String(user.id), name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered.' });
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!requireDb(res)) return;
  const { email, password } = req.body || {};
  try {
    const result = await pool.query('SELECT id,name,email,password_hash,role,contact_phone FROM users WHERE email=$1', [String(email || '').trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    const safeUser = { id: String(user.id), name: user.name, email: user.email, role: user.role, contact_phone: user.contact_phone || null };
    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: safeUser, token });
  } catch { res.status(500).json({ error: 'Login failed.' }); }
});

app.get('/api/me', auth, async (req, res) => {
  if (!pool) return res.json({ user: req.user });
  try {
    const result = await pool.query('SELECT id,name,email,role,contact_phone FROM users WHERE id=$1', [req.user.id]);
    const user = result.rows[0] ? { id: String(result.rows[0].id), name: result.rows[0].name, email: result.rows[0].email, role: result.rows[0].role, contact_phone: result.rows[0].contact_phone || null } : req.user;
    res.json({ user });
  } catch { res.json({ user: req.user }); }
});

app.patch('/api/me/contact', auth, async (req, res) => {
  if (!requireDb(res)) return;
  const contactPhone = String(req.body?.contactPhone || '').trim();
  const digits = contactPhone.replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(digits)) return res.status(400).json({ error: 'Enter a valid contact phone number.' });
  try {
    const result = await pool.query('UPDATE users SET contact_phone=$1 WHERE id=$2 RETURNING id,name,email,role,contact_phone', [digits, req.user.id]);
    res.json({ user: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not save contact phone.' }); }
});

app.get('/api/admin/stats', auth, adminOnly, async (_req, res) => {
  if (!requireDb(res)) return;
  try {
    const [users, sellers, orders, paid] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='seller'"),
      pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(total),0)::numeric AS gross FROM orders"),
      pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(total),0)::numeric AS gross FROM orders WHERE payment_status IN ('completed','paid','success','succeeded')")
    ]);
    const paidGross = Number(paid.rows[0].gross || 0);
    const commissionRate = Number(process.env.DEFAULT_COMMISSION_RATE || 0.05);
    res.json({ currency: 'MRU', users: users.rows[0].count, sellers: sellers.rows[0].count, orders: orders.rows[0].count, grossSales: Number(orders.rows[0].gross || 0), paidOrders: paid.rows[0].count, paidSales: paidGross, estimatedCommission: paidGross * commissionRate, commissionRate });
  } catch { res.status(500).json({ error: 'Could not load admin statistics.' }); }
});

app.get('/api/products', async (req, res) => {
  if (!pool) return res.json({ products: [] });
  const { category, q } = req.query;
  const values = [];
  const where = ['p.active = TRUE'];
  if (category && category !== 'الكل') { values.push(category); where.push(`p.category = $${values.length}`); }
  if (q) { values.push(`%${String(q).trim()}%`); where.push(`p.title ILIKE $${values.length}`); }
  try {
    const result = await pool.query(`SELECT p.id,p.seller_id,p.title,p.description,p.category,p.price,p.image_url,p.created_at,u.contact_phone AS seller_phone FROM products p LEFT JOIN users u ON u.id=p.seller_id WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC`, values);
    res.json({ products: result.rows });
  } catch { res.status(500).json({ error: 'Could not load products.' }); }
});

app.get('/api/products/mine', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await pool.query('SELECT id,seller_id,title,description,category,price,image_url,active,created_at FROM products WHERE seller_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ products: result.rows });
  } catch { res.status(500).json({ error: 'Could not load seller products.' }); }
});

app.post('/api/products', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const { title, description = '', category, price, imageUrl = '' } = req.body || {};
  const numericPrice = Number(price);
  if (!title?.trim() || !category || !Number.isFinite(numericPrice) || numericPrice <= 0) return res.status(400).json({ error: 'Invalid product data.' });
  try {
    const result = await pool.query('INSERT INTO products (seller_id,title,description,category,price,image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,seller_id,title,description,category,price,image_url,active,created_at', [req.user.id, title.trim(), description.trim(), category, numericPrice, imageUrl.trim()]);
    res.status(201).json({ product: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not create product.' }); }
});

app.patch('/api/products/:id', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const { title, description, category, price, imageUrl } = req.body || {};
  const updates = [];
  const values = [];
  let paramCount = 1;
  if (title !== undefined) { const trimmed = String(title).trim(); if (!trimmed) return res.status(400).json({ error: 'Title cannot be empty.' }); updates.push(`title = $${paramCount++}`); values.push(trimmed); }
  if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(String(description).trim()); }
  if (category !== undefined) { const trimmed = String(category).trim(); if (!trimmed) return res.status(400).json({ error: 'Category cannot be empty.' }); updates.push(`category = $${paramCount++}`); values.push(trimmed); }
  if (price !== undefined) { const numericPrice = Number(price); if (!Number.isFinite(numericPrice) || numericPrice <= 0) return res.status(400).json({ error: 'Price must be a positive number.' }); updates.push(`price = $${paramCount++}`); values.push(numericPrice); }
  if (imageUrl !== undefined) { updates.push(`image_url = $${paramCount++}`); values.push(String(imageUrl).trim()); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
  values.push(req.params.id, req.user.id);
  try {
    const result = await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount++} AND seller_id = $${paramCount++} RETURNING id,seller_id,title,description,category,price,image_url,active,created_at`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not update product.' }); }
});

app.delete('/api/products/:id', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1 AND seller_id=$2 RETURNING id', [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not delete product.' }); }
});

app.post('/api/orders', auth, async (req, res) => {
  if (!requireDb(res)) return;
  const { customerName, phone, city, address, items, total } = req.body || {};
  if (!customerName?.trim() || !phone?.trim() || !city?.trim() || !address?.trim() || !Array.isArray(items) || !items.length || !Number.isFinite(Number(total))) return res.status(400).json({ error: 'Complete your contact and delivery details.' });
  try {
    const result = await pool.query('INSERT INTO orders (buyer_id,customer_name,phone,city,address,total,status,payment_method,payment_status,items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status,payment_method,payment_status,total,created_at', [req.user.id, customerName.trim(), phone.trim(), city.trim(), address.trim(), Number(total), 'جديد', 'contact', 'not_required', JSON.stringify(items)]);
    res.status(201).json({ order: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not create contact request.' }); }
});

app.get('/api/orders/mine', auth, async (req, res) => {
  if (!requireDb(res)) return;
  try { const result = await pool.query('SELECT id,status,total,payment_method,payment_status,items,created_at FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC', [req.user.id]); res.json({ orders: result.rows }); }
  catch { res.status(500).json({ error: 'Could not load orders.' }); }
});

app.get('/api/seller/orders', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  try { const result = await pool.query('SELECT o.id,o.customer_name,o.phone,o.city,o.address,o.total,o.status,o.payment_method,o.payment_status,o.items,o.created_at FROM orders o WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) item WHERE (item->>\'sellerId\')::bigint=$1) ORDER BY o.created_at DESC', [req.user.id]); res.json({ orders: result.rows }); }
  catch { res.status(500).json({ error: 'Could not load seller orders.' }); }
});

app.patch('/api/seller/orders/:id/status', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const status = String(req.body?.status || '').trim();
  const allowed = new Set(['جديد','قيد التجهيز','تم الشحن','مكتمل','ملغي']);
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid order status.' });
  try { const result = await pool.query("UPDATE orders SET status=$1 WHERE id=$2 AND EXISTS (SELECT 1 FROM jsonb_array_elements(items) item WHERE (item->>'sellerId')::bigint=$3) RETURNING id,status", [status, req.params.id, req.user.id]); if (!result.rowCount) return res.status(404).json({ error: 'Order not found.' }); res.json({ order: result.rows[0] }); }
  catch { res.status(500).json({ error: 'Could not update order status.' }); }
});

app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist', 'index.html')));

initDb().then(() => app.listen(PORT, () => console.log(`BAYAA API listening on ${PORT}`))).catch((err) => { console.error('Database initialization failed:', err); process.exit(1); });