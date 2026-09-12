import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingCart, UserRound, Heart, MapPin, Menu, X, Plus, Minus, Trash2, Store, Smartphone, Shirt, Home, Car, Sparkles } from 'lucide-react';
import './styles.css';

const products = [
  { id: 1, title: 'هاتف ذكي حديث', price: 8900, category: 'إلكترونيات', icon: Smartphone },
  { id: 2, title: 'قميص Polo أنيق', price: 650, category: 'ملابس', icon: Shirt },
  { id: 3, title: 'طقم عطور فاخر', price: 3200, category: 'عطور', icon: Sparkles },
  { id: 4, title: 'أريكة منزلية عصرية', price: 12500, category: 'المنزل', icon: Home },
  { id: 5, title: 'إكسسوارات سيارة', price: 1400, category: 'سيارات', icon: Car },
  { id: 6, title: 'منتج إلكتروني مميز', price: 4200, category: 'إلكترونيات', icon: Smartphone },
];

const categories = [
  ['الكل', Store], ['إلكترونيات', Smartphone], ['ملابس', Shirt], ['المنزل', Home], ['سيارات', Car], ['عطور', Sparkles]
];

function App() {
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [openCart, setOpenCart] = useState(false);
  const [menu, setMenu] = useState(false);

  const filtered = useMemo(() => products.filter(p =>
    (category === 'الكل' || p.category === category) && p.title.includes(query)
  ), [category, query]);

  const add = (product) => setCart(c => [...c, product]);
  const remove = (id) => setCart(c => c.filter((_, i) => i !== id));
  const total = cart.reduce((sum, p) => sum + p.price, 0);

  return <div className="app">
    <header className="header">
      <div className="container nav">
        <button className="icon mobile-menu" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
        <div className="logo"><span>بياع</span><small>BAYAA</small></div>
        <nav className={menu ? 'links open' : 'links'}>
          <a href="#home">الرئيسية</a><a href="#products">المنتجات</a><a href="#sell">بع معنا</a><a href="#about">عن بياع</a>
        </nav>
        <div className="actions">
          <button className="icon"><UserRound/></button>
          <button className="cart-btn" onClick={() => setOpenCart(true)}><ShoppingCart/><b>{cart.length}</b></button>
        </div>
      </div>
    </header>

    <main>
      <section id="home" className="hero">
        <div className="container hero-inner">
          <div>
            <div className="badge"><Sparkles size={16}/> سوق موريتانيا بين يديك</div>
            <h1>اشترِ، بِع، <span>واربح مع بياع</span></h1>
            <p>منصة سوق رقمية سهلة وآمنة تجمع البائعين والمشترين في مكان واحد.</p>
            <div className="search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن منتج أو خدمة..."/></div>
            <div className="hero-stats"><div><strong>+1000</strong><small>منتج</small></div><div><strong>+300</strong><small>بائع</small></div><div><strong>24/7</strong><small>خدمة</small></div></div>
          </div>
          <div className="hero-card"><div className="hero-circle"><ShoppingCart size={64}/></div><strong>كل ما تحتاجه</strong><span>في مكان واحد</span></div>
        </div>
      </section>

      <section className="container category-wrap">
        <div className="section-head"><h2>تصفح الأقسام</h2><a href="#products">عرض الكل</a></div>
        <div className="categories">{categories.map(([name, Icon]) => <button key={name} className={category === name ? 'cat active' : 'cat'} onClick={() => setCategory(name)}><Icon/><span>{name}</span></button>)}</div>
      </section>

      <section id="products" className="container products-section">
        <div className="section-head"><div><h2>منتجات مختارة</h2><p>اكتشف أفضل العروض المتاحة الآن</p></div></div>
        <div className="grid">{filtered.map(p => <article className="product" key={p.id}>
          <button className="heart"><Heart size={19}/></button><div className="product-image"><p.icon size={55}/></div>
          <div className="product-body"><small>{p.category}</small><h3>{p.title}</h3><div className="price">{p.price.toLocaleString('ar-MR')} <span>MRU</span></div><button className="add" onClick={() => add(p)}><Plus size={18}/> أضف للسلة</button></div>
        </article>)}</div>
        {filtered.length === 0 && <div className="empty">لم نجد منتجات مطابقة لبحثك.</div>}
      </section>

      <section id="sell" className="sell container"><div><span className="eyebrow">للبائعين</span><h2>لديك منتج؟ ابدأ البيع مع بياع</h2><p>أنشئ متجرك، أضف منتجاتك، ووصل إلى عملاء جدد في موريتانيا.</p></div><button>ابدأ البيع الآن</button></section>
    </main>

    <footer id="about"><div className="container footer-inner"><div className="logo"><span>بياع</span><small>BAYAA</small></div><p>© 2026 BAYAA — سوقك الرقمي في موريتانيا</p></div></footer>

    {openCart && <div className="overlay" onClick={() => setOpenCart(false)}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><h2>سلة المشتريات</h2><button onClick={() => setOpenCart(false)}><X/></button></div>{cart.length === 0 ? <div className="empty"><ShoppingCart/><p>السلة فارغة</p></div> : <><div className="cart-list">{cart.map((p,i) => <div className="cart-item" key={i}><p.icon/><div><strong>{p.title}</strong><span>{p.price.toLocaleString('ar-MR')} MRU</span></div><button onClick={() => remove(i)}><Trash2 size={18}/></button></div>)}</div><div className="total"><span>الإجمالي</span><strong>{total.toLocaleString('ar-MR')} MRU</strong></div><button className="checkout">متابعة الطلب</button></>}</aside></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />);