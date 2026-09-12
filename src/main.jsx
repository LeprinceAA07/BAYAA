import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingCart, UserRound, Heart, Menu, X, Plus, Trash2, Store, Smartphone, Shirt, Home, Car, Sparkles, Package, LayoutDashboard, LogOut, MapPin, Phone, User, Eye, ShoppingBag, CheckCircle2 } from 'lucide-react';
import './styles.css';

const baseProducts = [
  { id: 1, title: 'هاتف ذكي حديث', price: 8900, category: 'إلكترونيات', description: 'هاتف ذكي عملي للاستخدام اليومي.', icon: Smartphone },
  { id: 2, title: 'قميص Polo أنيق', price: 650, category: 'ملابس', description: 'قميص Polo أنيق ومناسب للاستعمال اليومي.', icon: Shirt },
  { id: 3, title: 'طقم عطور فاخر', price: 3200, category: 'عطور', description: 'مجموعة عطور مميزة لمحبي الروائح الفاخرة.', icon: Sparkles },
  { id: 4, title: 'أريكة منزلية عصرية', price: 12500, category: 'المنزل', description: 'أريكة عصرية تضيف لمسة راقية إلى منزلك.', icon: Home },
  { id: 5, title: 'إكسسوارات سيارة', price: 1400, category: 'سيارات', description: 'إكسسوارات مفيدة لتحسين تجربة القيادة.', icon: Car },
  { id: 6, title: 'منتج إلكتروني مميز', price: 4200, category: 'إلكترونيات', description: 'منتج إلكتروني عملي للاستخدام اليومي.', icon: Smartphone },
];
const iconByCategory = { إلكترونيات: Smartphone, ملابس: Shirt, المنزل: Home, سيارات: Car, عطور: Sparkles };
const categories = [['الكل', Store], ['إلكترونيات', Smartphone], ['ملابس', Shirt], ['المنزل', Home], ['سيارات', Car], ['عطور', Sparkles]];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };

function App() {
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [sellerProducts, setSellerProducts] = useState(() => read('bayaa-seller-products', []));
  const [cart, setCart] = useState(() => read('bayaa-cart', []));
  const [favorites, setFavorites] = useState(() => read('bayaa-favorites', []));
  const [orders, setOrders] = useState(() => read('bayaa-orders', []));
  const [openCart, setOpenCart] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [orderDone, setOrderDone] = useState(null);
  const [menu, setMenu] = useState(false);
  const [sellerTab, setSellerTab] = useState('dashboard');
  const [addForm, setAddForm] = useState({ title: '', price: '', category: 'إلكترونيات', description: '' });
  const [customer, setCustomer] = useState({ name: '', phone: '', city: 'نواكشوط', address: '' });

  const allProducts = useMemo(() => [...baseProducts, ...sellerProducts], [sellerProducts]);
  useEffect(() => localStorage.setItem('bayaa-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('bayaa-favorites', JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem('bayaa-seller-products', JSON.stringify(sellerProducts)), [sellerProducts]);
  useEffect(() => localStorage.setItem('bayaa-orders', JSON.stringify(orders)), [orders]);

  const filtered = useMemo(() => allProducts.filter(p => (category === 'الكل' || p.category === category) && p.title.toLowerCase().includes(query.trim().toLowerCase())), [allProducts, category, query]);
  const add = product => setCart(c => [...c, product]);
  const remove = index => setCart(c => c.filter((_, i) => i !== index));
  const clearCart = () => setCart([]);
  const toggleFavorite = id => setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  const total = cart.reduce((sum, p) => sum + Number(p.price), 0);
  const sellerSales = orders.reduce((sum, o) => sum + o.total, 0);

  const createProduct = e => {
    e.preventDefault();
    const price = Number(addForm.price);
    if (!addForm.title.trim() || !price || price < 1) return;
    const product = { id: `seller-${Date.now()}`, title: addForm.title.trim(), price, category: addForm.category, description: addForm.description.trim() || 'منتج جديد على بياع.', icon: iconByCategory[addForm.category] || Package, sellerCreated: true };
    setSellerProducts(p => [product, ...p]);
    setAddForm({ title: '', price: '', category: 'إلكترونيات', description: '' });
    setSellerTab('products');
  };

  const placeOrder = e => {
    e.preventDefault();
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim() || cart.length === 0) return;
    const order = { id: `BY-${Date.now().toString().slice(-8)}`, customer: { ...customer }, items: cart, total, status: 'جديد', createdAt: new Date().toISOString() };
    setOrders(o => [order, ...o]);
    setCart([]);
    setCheckoutOpen(false);
    setOpenCart(false);
    setOrderDone(order);
  };

  return <div className="app" dir="rtl">
    <header className="header"><div className="container nav">
      <button className="icon mobile-menu" onClick={() => setMenu(!menu)} aria-label="القائمة">{menu ? <X/> : <Menu/>}</button>
      <a className="logo" href="#home"><span>بياع</span><small>BAYAA</small></a>
      <nav className={menu ? 'links open' : 'links'}><a href="#home" onClick={() => setMenu(false)}>الرئيسية</a><a href="#products" onClick={() => setMenu(false)}>المنتجات</a><a href="#sell" onClick={() => setMenu(false)}>بع معنا</a><a href="#about" onClick={() => setMenu(false)}>عن بياع</a></nav>
      <div className="actions"><button className="icon" aria-label="حساب البائع" onClick={() => setSellerOpen(true)}><UserRound/></button><button className="cart-btn" onClick={() => setOpenCart(true)} aria-label="السلة"><ShoppingCart/><b>{cart.length}</b></button></div>
    </div></header>

    <main>
      <section id="home" className="hero"><div className="container hero-inner"><div><div className="badge"><Sparkles size={16}/> سوق موريتانيا بين يديك</div><h1>اشترِ، بِع، <span>واربح مع بياع</span></h1><p>منصة سوق رقمية سهلة وآمنة تجمع البائعين والمشترين في مكان واحد.</p><div className="search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن منتج..." aria-label="البحث"/></div><div className="hero-stats"><div><strong>+1000</strong><small>منتج</small></div><div><strong>+300</strong><small>بائع</small></div><div><strong>24/7</strong><small>خدمة</small></div></div></div><div className="hero-card"><div className="hero-circle"><ShoppingCart size={64}/></div><strong>كل ما تحتاجه</strong><span>في مكان واحد</span></div></div></section>

      <section className="container category-wrap"><div className="section-head"><h2>تصفح الأقسام</h2><a href="#products">عرض الكل</a></div><div className="categories">{categories.map(([name, Icon]) => <button key={name} className={category === name ? 'cat active' : 'cat'} onClick={() => setCategory(name)}><Icon/><span>{name}</span></button>)}</div></section>

      <section id="products" className="container products-section"><div className="section-head"><div><h2>منتجات مختارة</h2><p>اكتشف أفضل العروض المتاحة الآن</p></div></div><div className="grid">{filtered.map(p => { const Icon = p.icon || Package; const fav = favorites.includes(p.id); return <article className="product" key={p.id} onClick={() => setDetails(p)}><button className={fav ? 'heart active' : 'heart'} onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }} aria-label="المفضلة"><Heart size={19} fill={fav ? 'currentColor' : 'none'}/></button><div className="product-image"><Icon size={55}/></div><div className="product-body"><small>{p.category}</small><h3>{p.title}</h3><div className="price">{Number(p.price).toLocaleString('ar-MR')} <span>MRU</span></div><button className="add" onClick={e => { e.stopPropagation(); add(p); }}><Plus size={18}/> أضف للسلة</button></div></article>; })}</div>{filtered.length === 0 && <div className="empty">لم نجد منتجات مطابقة لبحثك.</div>}</section>

      <section id="sell" className="sell container"><div><span className="eyebrow">للبائعين</span><h2>لديك منتج؟ ابدأ البيع مع بياع</h2><p>أنشئ متجرك، أضف منتجاتك، ووصل إلى عملاء جدد في موريتانيا.</p></div><button onClick={() => setSellerOpen(true)}>ابدأ البيع الآن</button></section>
    </main>
    <footer id="about"><div className="container footer-inner"><div className="logo"><span>بياع</span><small>BAYAA</small></div><p>© 2026 BAYAA — سوقك الرقمي في موريتانيا</p></div></footer>

    {details && <div className="overlay" onClick={() => setDetails(null)}><aside className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setDetails(null)}><X/></button>{React.createElement(details.icon || Package, { size: 64 })}<span className="eyebrow">{details.category}</span><h2>{details.title}</h2><p>{details.description}</p><div className="price large">{Number(details.price).toLocaleString('ar-MR')} <span>MRU</span></div><button className="checkout" onClick={() => { add(details); setDetails(null); setOpenCart(true); }}><ShoppingBag size={18}/> أضف للسلة</button></aside></div>}

    {openCart && <div className="overlay" onClick={() => setOpenCart(false)}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><h2>سلة المشتريات</h2><button onClick={() => setOpenCart(false)} aria-label="إغلاق"><X/></button></div>{cart.length === 0 ? <div className="empty"><ShoppingCart/><p>السلة فارغة</p></div> : <><div className="cart-list">{cart.map((p,i) => { const Icon = p.icon || Package; return <div className="cart-item" key={`${p.id}-${i}`}><Icon/><div><strong>{p.title}</strong><span>{Number(p.price).toLocaleString('ar-MR')} MRU</span></div><button onClick={() => remove(i)} aria-label="حذف"><Trash2 size={18}/></button></div>})}</div><div className="total"><span>الإجمالي</span><strong>{total.toLocaleString('ar-MR')} MRU</strong></div><div className="drawer-actions"><button className="clear" onClick={clearCart}>تفريغ السلة</button><button className="checkout" onClick={() => setCheckoutOpen(true)}>متابعة الطلب</button></div></>}</aside></div>}

    {checkoutOpen && <div className="overlay" onClick={() => setCheckoutOpen(false)}><aside className="modal checkout-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setCheckoutOpen(false)}><X/></button><div className="modal-icon"><ShoppingBag/></div><h2>تأكيد الطلب</h2><p>أدخل بيانات التوصيل لإرسال طلبك.</p><form className="form" onSubmit={placeOrder}><label><User size={17}/> الاسم<input required value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="اسمك الكامل"/></label><label><Phone size={17}/> رقم الهاتف<input required type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="رقم الهاتف"/></label><label><MapPin size={17}/> المدينة<input required value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} placeholder="المدينة"/></label><label><MapPin size={17}/> العنوان<input required value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} placeholder="العنوان بالتفصيل"/></label><div className="total"><span>الإجمالي</span><strong>{total.toLocaleString('ar-MR')} MRU</strong></div><button className="checkout" type="submit">تأكيد الطلب</button></form></aside></div>}

    {orderDone && <div className="overlay" onClick={() => setOrderDone(null)}><aside className="modal success" onClick={e => e.stopPropagation()}><CheckCircle2 size={70}/><h2>تم استلام طلبك</h2><p>رقم الطلب: <strong>{orderDone.id}</strong></p><p>سنتواصل معك لتأكيد الطلب والتوصيل.</p><button className="checkout" onClick={() => setOrderDone(null)}>حسنًا</button></aside></div>}

    {sellerOpen && <div className="overlay" onClick={() => setSellerOpen(false)}><aside className="seller-panel" onClick={e => e.stopPropagation()}><div className="seller-head"><div><span className="eyebrow">BAYAA SELLER</span><h2>لوحة البائع</h2></div><button onClick={() => setSellerOpen(false)} aria-label="إغلاق"><X/></button></div><div className="seller-nav"><button className={sellerTab === 'dashboard' ? 'seller-tab active' : 'seller-tab'} onClick={() => setSellerTab('dashboard')}><LayoutDashboard size={17}/> الرئيسية</button><button className={sellerTab === 'products' ? 'seller-tab active' : 'seller-tab'} onClick={() => setSellerTab('products')}><Package size={17}/> المنتجات</button></div>
      {sellerTab === 'dashboard' ? <div className="seller-content"><div className="seller-stats"><div><strong>{orders.length}</strong><span>الطلبات</span></div><div><strong>{sellerSales.toLocaleString('ar-MR')} MRU</strong><span>المبيعات</span></div><div><strong>{sellerProducts.length}</strong><span>منتجاتي</span></div></div><div className="seller-card"><Store/><div><h3>متجرك جاهز للانطلاق</h3><p>أضف منتجاتك وستظهر مباشرة في سوق بياع.</p></div><button onClick={() => setSellerTab('products')}>إضافة منتج</button></div>{orders.length > 0 && <div className="seller-card"><ShoppingBag/><div><h3>آخر الطلبات</h3><p>{orders.slice(0,3).map(o => `${o.id} — ${o.total.toLocaleString('ar-MR')} MRU`).join(' • ')}</p></div></div>}</div> : <div className="seller-content"><form className="form seller-form" onSubmit={createProduct}><h3>إضافة منتج جديد</h3><label>اسم المنتج<input required value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })} placeholder="مثال: هاتف Samsung"/></label><label>السعر (MRU)<input required type="number" min="1" value={addForm.price} onChange={e => setAddForm({ ...addForm, price: e.target.value })} placeholder="5000"/></label><label>القسم<select value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })}>{categories.slice(1).map(([name]) => <option key={name}>{name}</option>)}</select></label><label>الوصف<textarea value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} placeholder="وصف مختصر للمنتج" rows="3"/></label><button className="checkout" type="submit"><Plus size={18}/> نشر المنتج</button></form>{sellerProducts.length > 0 && <div className="seller-products-list">{sellerProducts.map(p => <div className="seller-product-row" key={p.id}><Package size={20}/><div><strong>{p.title}</strong><span>{Number(p.price).toLocaleString('ar-MR')} MRU</span></div><button onClick={() => setSellerProducts(x => x.filter(y => y.id !== p.id))}><Trash2 size={17}/></button></div>)}</div>}</div>}
      <button className="seller-logout" onClick={() => setSellerOpen(false)}><LogOut size={17}/> إغلاق لوحة البائع</button></aside></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
