import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingCart, UserRound, Heart, Menu, X, Plus, Trash2, Store, Smartphone, Shirt, Home, Car, Sparkles, Package, LayoutDashboard, LogOut } from 'lucide-react';
import './styles.css';

const products = [
  { id: 1, title: 'هاتف ذكي حديث', price: 8900, category: 'إلكترونيات', icon: Smartphone },
  { id: 2, title: 'قميص Polo أنيق', price: 650, category: 'ملابس', icon: Shirt },
  { id: 3, title: 'طقم عطور فاخر', price: 3200, category: 'عطور', icon: Sparkles },
  { id: 4, title: 'أريكة منزلية عصرية', price: 12500, category: 'المنزل', icon: Home },
  { id: 5, title: 'إكسسوارات سيارة', price: 1400, category: 'سيارات', icon: Car },
  { id: 6, title: 'منتج إلكتروني مميز', price: 4200, category: 'إلكترونيات', icon: Smartphone },
];
const categories = [['الكل', Store], ['إلكترونيات', Smartphone], ['ملابس', Shirt], ['المنزل', Home], ['سيارات', Car], ['عطور', Sparkles]];

function App() {
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('bayaa-cart') || '[]'));
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('bayaa-favorites') || '[]'));
  const [openCart, setOpenCart] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sellerTab, setSellerTab] = useState('dashboard');

  useEffect(() => localStorage.setItem('bayaa-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('bayaa-favorites', JSON.stringify(favorites)), [favorites]);

  const filtered = useMemo(() => products.filter(p => (category === 'الكل' || p.category === category) && p.title.includes(query.trim())), [category, query]);
  const add = product => setCart(c => [...c, product]);
  const remove = index => setCart(c => c.filter((_, i) => i !== index));
  const clearCart = () => setCart([]);
  const toggleFavorite = id => setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  const total = cart.reduce((sum, p) => sum + p.price, 0);

  return <div className="app" dir="rtl">
    <header className="header"><div className="container nav">
      <button className="icon mobile-menu" onClick={() => setMenu(!menu)} aria-label="القائمة">{menu ? <X/> : <Menu/>}</button>
      <a className="logo" href="#home"><span>بياع</span><small>BAYAA</small></a>
      <nav className={menu ? 'links open' : 'links'}>
        <a href="#home" onClick={() => setMenu(false)}>الرئيسية</a><a href="#products" onClick={() => setMenu(false)}>المنتجات</a><a href="#sell" onClick={() => setMenu(false)}>بع معنا</a><a href="#about" onClick={() => setMenu(false)}>عن بياع</a>
      </nav>
      <div className="actions"><button className="icon" aria-label="حساب البائع" onClick={() => setSellerOpen(true)}><UserRound/></button><button className="cart-btn" onClick={() => setOpenCart(true)} aria-label="السلة"><ShoppingCart/><b>{cart.length}</b></button></div>
    </div></header>

    <main>
      <section id="home" className="hero"><div className="container hero-inner"><div>
        <div className="badge"><Sparkles size={16}/> سوق موريتانيا بين يديك</div>
        <h1>اشترِ، بِع، <span>واربح مع بياع</span></h1>
        <p>منصة سوق رقمية سهلة وآمنة تجمع البائعين والمشترين في مكان واحد.</p>
        <div className="search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن منتج..." aria-label="البحث"/></div>
        <div className="hero-stats"><div><strong>+1000</strong><small>منتج</small></div><div><strong>+300</strong><small>بائع</small></div><div><strong>24/7</strong><small>خدمة</small></div></div>
      </div><div className="hero-card"><div className="hero-circle"><ShoppingCart size={64}/></div><strong>كل ما تحتاجه</strong><span>في مكان واحد</span></div></div></section>

      <section className="container category-wrap"><div className="section-head"><h2>تصفح الأقسام</h2><a href="#products">عرض الكل</a></div><div className="categories">{categories.map(([name, Icon]) => <button key={name} className={category === name ? 'cat active' : 'cat'} onClick={() => setCategory(name)}><Icon/><span>{name}</span></button>)}</div></section>

      <section id="products" className="container products-section"><div className="section-head"><div><h2>منتجات مختارة</h2><p>اكتشف أفضل العروض المتاحة الآن</p></div></div>
        <div className="grid">{filtered.map(p => { const Icon = p.icon; const fav = favorites.includes(p.id); return <article className="product" key={p.id}>
          <button className={fav ? 'heart active' : 'heart'} onClick={() => toggleFavorite(p.id)} aria-label="المفضلة"><Heart size={19} fill={fav ? 'currentColor' : 'none'}/></button>
          <div className="product-image"><Icon size={55}/></div><div className="product-body"><small>{p.category}</small><h3>{p.title}</h3><div className="price">{p.price.toLocaleString('ar-MR')} <span>MRU</span></div><button className="add" onClick={() => add(p)}><Plus size={18}/> أضف للسلة</button></div>
        </article>})}</div>{filtered.length === 0 && <div className="empty">لم نجد منتجات مطابقة لبحثك.</div>}
      </section>

      <section id="sell" className="sell container"><div><span className="eyebrow">للبائعين</span><h2>لديك منتج؟ ابدأ البيع مع بياع</h2><p>أنشئ متجرك، أضف منتجاتك، ووصل إلى عملاء جدد في موريتانيا.</p></div><button onClick={() => setSellerOpen(true)}>ابدأ البيع الآن</button></section>
    </main>

    <footer id="about"><div className="container footer-inner"><div className="logo"><span>بياع</span><small>BAYAA</small></div><p>© 2026 BAYAA — سوقك الرقمي في موريتانيا</p></div></footer>

    {openCart && <div className="overlay" onClick={() => setOpenCart(false)}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><h2>سلة المشتريات</h2><button onClick={() => setOpenCart(false)} aria-label="إغلاق"><X/></button></div>
      {cart.length === 0 ? <div className="empty"><ShoppingCart/><p>السلة فارغة</p></div> : <><div className="cart-list">{cart.map((p,i) => { const Icon = p.icon; return <div className="cart-item" key={`${p.id}-${i}`}><Icon/><div><strong>{p.title}</strong><span>{p.price.toLocaleString('ar-MR')} MRU</span></div><button onClick={() => remove(i)} aria-label="حذف"><Trash2 size={18}/></button></div>})}</div><div className="total"><span>الإجمالي</span><strong>{total.toLocaleString('ar-MR')} MRU</strong></div><div className="drawer-actions"><button className="clear" onClick={clearCart}>تفريغ السلة</button><button className="checkout" onClick={() => alert('سيتم ربط بوابة الدفع بعد إنشاء نظام الطلبات.')}>متابعة الطلب</button></div></>}
    </aside></div>}

    {sellerOpen && <div className="overlay" onClick={() => setSellerOpen(false)}><aside className="seller-panel" onClick={e => e.stopPropagation()}>
      <div className="seller-head"><div><span className="eyebrow">BAYAA SELLER</span><h2>لوحة البائع</h2></div><button onClick={() => setSellerOpen(false)} aria-label="إغلاق"><X/></button></div>
      <div className="seller-nav"><button className={sellerTab === 'dashboard' ? 'seller-tab active' : 'seller-tab'} onClick={() => setSellerTab('dashboard')}><LayoutDashboard size={17}/> الرئيسية</button><button className={sellerTab === 'products' ? 'seller-tab active' : 'seller-tab'} onClick={() => setSellerTab('products')}><Package size={17}/> المنتجات</button></div>
      {sellerTab === 'dashboard' ? <div className="seller-content"><div className="seller-stats"><div><strong>0</strong><span>الطلبات</span></div><div><strong>0 MRU</strong><span>المبيعات</span></div><div><strong>0</strong><span>المنتجات</span></div></div><div className="seller-card"><Store/><div><h3>ابدأ متجرك الآن</h3><p>أضف منتجاتك وحدد أسعارك واستعد لاستقبال الطلبات.</p></div><button onClick={() => setSellerTab('products')}>إضافة منتج</button></div></div> : <div className="seller-content"><div className="seller-card"><Package/><div><h3>منتجات متجرك</h3><p>لا توجد منتجات بعد. هذه الواجهة جاهزة لربط قاعدة البيانات لاحقًا.</p></div><button onClick={() => alert('نموذج إضافة المنتج سيُربط بقاعدة البيانات في المرحلة التالية.')}>إضافة منتج</button></div></div>}
      <button className="seller-logout" onClick={() => setSellerOpen(false)}><LogOut size={17}/> إغلاق لوحة البائع</button>
    </aside></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);