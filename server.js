import 'dotenv/config';
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
app.use(express.json({ limit: '1mb' }));

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

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const sellerOnly = (req, res, next) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Seller account required.' });
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
      payment_method TEXT NOT NULL DEFAULT 'cod',
      items JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='orders' AND column_name='payment_method'
      ) THEN
        ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cod';
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
    const result = await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role', [name.trim(), email.trim().toLowerCase(), hash, role]);
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
    const result = await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE email=$1', [String(email || '').trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    const safeUser = { id: String(user.id), name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: safeUser, token });
  } catch { res.status(500).json({ error: 'Login failed.' }); }
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/products', async (req, res) => {
  if (!pool) return res.json({ products: [] });
  const { category, q } = req.query;
  const values = [];
  const where = ['active = TRUE'];
  if (category && category !== 'الكل') { values.push(category); where.push(`category = $${values.length}`); }
  if (q) { values.push(`%${String(q).trim()}%`); where.push(`title ILIKE $${values.length}`); }
  try {
    const result = await pool.query(`SELECT id,seller_id,title,description,category,price,image_url,created_at FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, values);
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
  const { customerName, phone, city, address, items, total, paymentMethod = 'cod' } = req.body || {};
  const allowedPaymentMethods = new Set(['cod','bankily','sedad','masrivi']);
  if (!customerName?.trim() || !phone?.trim() || !city?.trim() || !address?.trim() || !Array.isArray(items) || !items.length || !Number.isFinite(Number(total)) || !allowedPaymentMethods.has(paymentMethod)) return res.status(400).json({ error: 'Invalid order data.' });
  try {
    const result = await pool.query('INSERT INTO orders (buyer_id,customer_name,phone,city,address,total,status,payment_method,items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,status,payment_method,total,created_at', [req.user.id, customerName.trim(), phone.trim(), city.trim(), address.trim(), Number(total), paymentMethod === 'cod' ? 'جديد' : 'بانتظار الدفع', paymentMethod, JSON.stringify(items)]);
    res.status(201).json({ order: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not create order.' }); }
});

app.get('/api/orders/mine', auth, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await pool.query('SELECT id,status,payment_method,total,customer_name,phone,city,address,items,created_at FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ orders: result.rows });
  } catch { res.status(500).json({ error: 'Could not load orders.' }); }
});

app.get('/api/seller/orders', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await pool.query(`SELECT o.id,o.status,o.payment_method,o.total,o.customer_name,o.city,o.created_at,o.items FROM orders o WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) item WHERE item->>'sellerId' = $1) ORDER BY o.created_at DESC`, [String(req.user.id)]);
    res.json({ orders: result.rows });
  } catch { res.status(500).json({ error: 'Could not load seller orders.' }); }
});

// Moosyl payment initiation. Secret key must stay on the server; never expose it to the browser.
app.post('/api/payments/create', auth, async (req, res) => {
  if (!process.env.MOOSYL_SECRET_KEY) return res.status(503).json({ error: 'Payment provider is not configured yet.' });
  const amount = Number(req.body?.amount);
  const transactionId = String(req.body?.transactionId || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !transactionId) return res.status(400).json({ error: 'Invalid payment data.' });
  try {
    const response = await fetch('https://api.moosyl.com/payment-request', {
      method: 'POST',
      headers: { Authorization: process.env.MOOSYL_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, transactionId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data?.error || 'Payment request failed.' });
    res.status(201).json({ transactionId: data.transactionId || transactionId });
  } catch {
    res.status(502).json({ error: 'Payment provider is unavailable.' });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(dist, 'index.html'));
  next();
});

initDb().then(() => app.listen(PORT, () => console.log(`BAYAA server listening on ${PORT}`))).catch(err => { console.error(err); process.exit(1); });
