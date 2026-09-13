import React from 'react';
import { createRoot } from 'react-dom/client';

function WelcomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 16px', background: '#f7faf9', color: '#102027', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #dbe6e3', borderRadius: 24, padding: 36, textAlign: 'center', boxShadow: '0 18px 50px rgba(15,118,110,.08)' }}>
        <div style={{ width: 72, height: 72, margin: '0 auto 20px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#dff7ef', color: '#0f766e', fontSize: 36, fontWeight: 900 }}>✓</div>
        <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(32px, 6vw, 48px)' }}>تم الاشتراك بنجاح</h1>
        <p style={{ margin: '0 auto 24px', maxWidth: 520, color: '#52636a', lineHeight: 1.8 }}>شكرًا لاشتراكك في BAYAA. قد يستغرق تحديث حالة الوصول بضع لحظات بعد وصول إشعار الدفع.</p>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '13px 22px', borderRadius: 12, background: '#0f766e', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>العودة إلى BAYAA</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById('welcome-root')).render(<WelcomePage />);
