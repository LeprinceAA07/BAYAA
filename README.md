# BAYAA — بياع

منصة سوق رقمية موجهة للسوق الموريتاني، بواجهة عربية RTL وقابلة للتحول إلى تطبيق هاتف.

## الحالة الحالية

- React + Vite للواجهة.
- Express API للخادم.
- PostgreSQL للحسابات والمنتجات والطلبات.
- JWT للمصادقة وbcryptjs لتجزئة كلمات المرور.
- لوحة بائع ومشتري وسلة ومفضلة وطلبات.
- PWA manifest وتجهيز Docker.
- Paddle Billing جاهز للإنتاج مع صفحة أسعار وCheckout overlay.
- Webhook Paddle يتحقق من `Paddle-Signature` وفق آلية التوقيع الرسمية.
- صفحة نجاح مستقلة على `/welcome` بعد إتمام Checkout.

## التشغيل المحلي

```bash
npm install
npm run dev
```

لتشغيل الخادم بعد بناء الواجهة:

```bash
npm run build
npm start
```

## قاعدة البيانات

انسخ `.env.example` إلى `.env` وضع بيانات PostgreSQL و`JWT_SECRET`.
الخادم ينشئ الجداول الأساسية تلقائيًا عند التشغيل.

## النشر

يمكن نشر المشروع على Railway أو Render أو أي منصة Node/Docker. يجب ضبط:

- `DATABASE_URL`
- `JWT_SECRET`
- `DATABASE_SSL` عند الحاجة
- `CLIENT_ORIGIN` عند الحاجة
- متغيرات Paddle Live الموجودة في `.env.example`

بعد النشر اختبر:

`/api/health`

## الدفع والصور

أسرار Paddle مثل API key وWebhook secret تبقى على الخادم فقط. Client-side token يمكن استخدامه في الواجهة، لكن يجب أن يكون `live_` في الإنتاج. يلزم اعتماد الحساب والمجال في Paddle قبل تحصيل دفعات حقيقية.
