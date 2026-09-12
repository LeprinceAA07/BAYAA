const { Paddle, Environment } = await import('@paddle/paddle-node-sdk');

const REQUIRED = ['PADDLE_ENVIRONMENT', 'PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET'];
function requireEnv(name) { const value = String(process.env[name] || '').trim(); if (!value) throw new Error(`Missing required Paddle environment variable: ${name}`); return value; }
const environment = requireEnv('PADDLE_ENVIRONMENT').toLowerCase();
if (!['sandbox','production','live'].includes(environment)) throw new Error(`PADDLE_ENVIRONMENT must be sandbox or production, got: ${environment}`);
const paddle = new Paddle(requireEnv('PADDLE_API_KEY'), { environment: environment === 'sandbox' ? Environment.sandbox : Environment.production });
const asText = v => v == null ? null : String(v);
const priceProduct = data => { const item = Array.isArray(data?.items) ? data.items[0] : null; return { priceId: asText(item?.price?.id || item?.priceId || data?.priceId), productId: asText(item?.price?.productId || item?.productId || data?.productId) }; };
const scheduled = data => { const x = data?.scheduledChange || data?.scheduled_change || null; return { action: asText(x?.action), at: asText(x?.effectiveAt || x?.effective_at) }; };

if (!pool) throw new Error('Paddle fulfillment requires DATABASE_URL.');
await pool.query(`
CREATE TABLE IF NOT EXISTS customers (customer_id TEXT PRIMARY KEY,email TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS subscriptions (subscription_id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(customer_id),status TEXT NOT NULL,price_id TEXT NOT NULL,product_id TEXT NOT NULL,scheduled_change_action TEXT,scheduled_change_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS paddle_transactions (transaction_id TEXT PRIMARY KEY,customer_id TEXT,subscription_id TEXT,status TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS paddle_webhook_events (event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
`);

async function upsertCustomer(data) {
  const id=asText(data?.id), email=asText(data?.email); if(!id||!email) return;
  await pool.query(`INSERT INTO customers(customer_id,email) VALUES($1,$2) ON CONFLICT(customer_id) DO UPDATE SET email=EXCLUDED.email,updated_at=NOW()`,[id,email]);
  await pool.query(`UPDATE users SET paddle_customer_id=$1 WHERE lower(email)=lower($2)`,[id,email]);
}
async function upsertSubscription(data) {
  const id=asText(data?.id), customerId=asText(data?.customerId||data?.customer_id), status=asText(data?.status), pp=priceProduct(data), sc=scheduled(data);
  if(!id||!customerId||!status||!pp.priceId||!pp.productId) throw new Error('subscription webhook missing id/customer/status/price/product');
  await pool.query(`INSERT INTO subscriptions(subscription_id,customer_id,status,price_id,product_id,scheduled_change_action,scheduled_change_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(subscription_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,status=EXCLUDED.status,price_id=EXCLUDED.price_id,product_id=EXCLUDED.product_id,scheduled_change_action=EXCLUDED.scheduled_change_action,scheduled_change_at=EXCLUDED.scheduled_change_at,updated_at=NOW()`,[id,customerId,status,pp.priceId,pp.productId,sc.action,sc.at]);
}
async function upsertTransaction(data) { const id=asText(data?.id); if(!id)return; await pool.query(`INSERT INTO paddle_transactions(transaction_id,customer_id,subscription_id,status) VALUES($1,$2,$3,$4) ON CONFLICT(transaction_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,subscription_id=EXCLUDED.subscription_id,status=EXCLUDED.status,updated_at=NOW()`,[id,asText(data?.customerId||data?.customer_id),asText(data?.subscriptionId||data?.subscription_id),asText(data?.status)||'completed']); }
const paidAccess = status => status === 'active' || status === 'trialing';

async function refreshPaddleIps() {
  const base=environment==='sandbox'?'https://sandbox-api.paddle.com':'https://api.paddle.com';
  const r=await fetch(`${base}/ips`,{headers:{Authorization:`Bearer ${requireEnv('PADDLE_API_KEY')}`}});
  if(!r.ok) throw new Error(`Unable to fetch Paddle IP allowlist: HTTP ${r.status}`);
  const body=await r.json(), cidrs=body?.data?.ipv4_cidrs;
  if(!Array.isArray(cidrs)||!cidrs.length) throw new Error('Paddle IP endpoint returned no IPv4 CIDRs');
  return new Set(cidrs.map(String));
}
function requestIp(req){ const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim(); return forwarded||String(req.ip||req.socket?.remoteAddress||'').replace(/^::ffff:/,''); }
let allowedPaddleIps=await refreshPaddleIps();
setInterval(async()=>{try{allowedPaddleIps=await refreshPaddleIps();}catch(e){console.error('[Paddle] IP allowlist refresh failed:',e);}},3600000).unref();

app.post('/api/webhooks/paddle',express.raw({type:'application/json',limit:'1mb'}),async(req,res,next)=>{
  if(!allowedPaddleIps.has(requestIp(req))) return res.status(403).json({error:'Webhook source IP is not allowed.'});
  const signature=String(req.headers['paddle-signature']||''), raw=Buffer.isBuffer(req.body)?req.body.toString('utf8'):String(req.body||'');
  if(!signature||!raw) return res.status(400).json({error:'Missing Paddle signature or body.'});
  let eventData; try{eventData=await paddle.webhooks.unmarshal(raw,requireEnv('PADDLE_WEBHOOK_SECRET'),signature);}catch(e){console.error('[Paddle] signature verification failed:',e);return res.status(401).json({error:'Invalid Paddle webhook signature.'});}
  const eventId=asText(eventData?.eventId||eventData?.id), eventType=asText(eventData?.eventType); if(!eventId||!eventType)return res.status(400).json({error:'Verified webhook is missing event metadata.'});
  try{
    const inserted=await pool.query(`INSERT INTO paddle_webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,[eventId,eventType]);
    if(!inserted.rowCount)return res.status(200).json({received:true,duplicate:true});
    switch(eventType){
      case 'customer.created': case 'customer.updated': await upsertCustomer(eventData.data); break;
      case 'subscription.created': case 'subscription.updated': case 'subscription.canceled': await upsertSubscription(eventData.data); break;
      case 'transaction.completed': await upsertTransaction(eventData.data); break;
      default: break;
    }
    return res.status(200).json({received:true});
  }catch(e){console.error(`[Paddle] ${eventType} handler failed:`,e);await pool.query('DELETE FROM paddle_webhook_events WHERE event_id=$1',[eventId]).catch(()=>{});return next(e);}
});

app.get('/api/billing/access',auth,async(req,res)=>{ const q=await pool.query(`SELECT s.subscription_id,s.status,s.price_id,s.product_id,s.scheduled_change_action,s.scheduled_change_at FROM users u JOIN subscriptions s ON s.customer_id=u.paddle_customer_id WHERE u.id=$1 ORDER BY s.updated_at DESC LIMIT 1`,[req.user.id]); const subscription=q.rows[0]||null; res.json({access:Boolean(subscription&&paidAccess(subscription.status)),subscription}); });
app.get('/api/billing/portal',auth,async(req,res)=>{
  const c=await pool.query(`SELECT c.customer_id FROM customers c JOIN users u ON lower(u.email)=lower(c.email) WHERE u.id=$1 LIMIT 1`,[req.user.id]);
  const customerId=c.rows[0]?.customer_id; if(!customerId)return res.status(404).json({error:'Paddle customer not found yet. Complete a subscription purchase first.'});
  const s=await pool.query(`SELECT subscription_id FROM subscriptions WHERE customer_id=$1 AND status <> 'canceled' ORDER BY updated_at DESC`,[customerId]);
  try{const session=await paddle.customerPortalSessions.create(customerId,s.rows.map(r=>r.subscription_id));const url=session?.urls?.general?.overview;if(!url)return res.status(502).json({error:'Paddle did not return a portal URL.'});return res.redirect(303,url);}catch(e){console.error('[Paddle] customer portal session failed:',e);return res.status(502).json({error:'Could not create Paddle customer portal session.'});}
});
