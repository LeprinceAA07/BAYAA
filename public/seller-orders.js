(() => {
  const API = (window.location.origin || '').replace(/\/$/, '');
  const labels = {cod:'الدفع عند الاستلام',bankily:'Bankily',sedad:'Sedad',masrivi:'Masrivi'};
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  async function loadOrders(panel){
    const token = localStorage.getItem('bayaa-token');
    if (!token || !panel || panel.dataset.ordersLoaded) return;
    panel.dataset.ordersLoaded='1';
    const box=document.createElement('section');
    box.style.cssText='margin-top:22px;border-top:1px solid #e5e7eb;padding-top:18px';
    box.innerHTML='<h3 style="margin:0 0 12px">طلبات العملاء</h3><div style="color:#64748b">جاري تحميل الطلبات...</div>';
    const content=panel.querySelector('.seller-content');
    if(!content)return;
    content.appendChild(box);
    try{
      const r=await fetch(`${API}/api/seller/orders`,{headers:{Authorization:`Bearer ${token}`}});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||'تعذر تحميل الطلبات');
      const orders=data.orders||[];
      if(!orders.length){box.innerHTML='<h3 style="margin:0 0 12px">طلبات العملاء</h3><div style="color:#64748b">لا توجد طلبات حتى الآن.</div>';return;}
      box.innerHTML='<h3 style="margin:0 0 12px">طلبات العملاء</h3>'+orders.map(o=>`<article style="border:1px solid #e5e7eb;border-radius:14px;padding:13px;margin:9px 0;background:#fff"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><strong>#${esc(o.id)}</strong><span style="font-weight:700">${Number(o.total||0).toLocaleString('ar-MR')} MRU</span></div><div style="font-size:13px;color:#475569;margin-top:7px">${esc(o.customer_name)} • ${esc(o.city)}</div><div style="font-size:13px;color:#475569;margin-top:5px">الدفع: ${esc(labels[o.payment_method]||o.payment_method||'—')}</div><div style="font-size:13px;margin-top:5px">الحالة: <strong>${esc(o.status||'جديد')}</strong></div></article>`).join('');
    }catch(e){box.innerHTML=`<h3 style="margin:0 0 12px">طلبات العملاء</h3><div style="color:#b91c1c">${esc(e.message)}</div>`;}
  }
  const observer=new MutationObserver(()=>{document.querySelectorAll('.seller-panel').forEach(loadOrders)});
  window.addEventListener('load',()=>observer.observe(document.body,{childList:true,subtree:true}));
})();
