import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../server.js', import.meta.url), 'utf8');
const marker = "app.delete('/api/products/:id', auth, sellerOnly, async (req, res) => {";

const patch = `app.patch('/api/products/:id', auth, sellerOnly, async (req, res) => {
  if (!requireDb(res)) return;
  const { title, description, category, price, imageUrl } = req.body || {};
  const numericPrice = Number(price);
  if (title !== undefined && !String(title).trim()) return res.status(400).json({ error: 'Invalid product title.' });
  if (price !== undefined && (!Number.isFinite(numericPrice) || numericPrice <= 0)) return res.status(400).json({ error: 'Invalid product price.' });
  try {
    const result = await pool.query(
      'UPDATE products SET title=COALESCE($1,title),description=COALESCE($2,description),category=COALESCE($3,category),price=COALESCE($4,price),image_url=COALESCE($5,image_url) WHERE id=$6 AND seller_id=$7 RETURNING id,seller_id,title,description,category,price,image_url,active,created_at',
      [title?.trim() ?? null, description?.trim() ?? null, category ?? null, price === undefined ? null : numericPrice, imageUrl?.trim() ?? null, req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: result.rows[0] });
  } catch { res.status(500).json({ error: 'Could not update product.' }); }
});

`;

const patched = source.includes("app.patch('/api/products/:id'") ? source : source.replace(marker, patch + marker);
const temp = new URL('../.bayaa-runtime-server.mjs', import.meta.url);
await fs.writeFile(temp, patched, 'utf8');
await import(`${temp.href}?v=${Date.now()}`);
