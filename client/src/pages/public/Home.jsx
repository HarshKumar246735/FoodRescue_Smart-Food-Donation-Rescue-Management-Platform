import { Link, useNavigate } from 'react-router-dom';
import { Apple, ArrowRight, Beef, CakeSlice, Carrot, CheckCircle2, ClipboardCheck, Heart, HandHeart, MapPin, Milk, Package, PackageSearch, ShieldCheck, Truck, Utensils } from 'lucide-react';
import { useState } from 'react';
import useFetch from '../../hooks/useFetch.js';
import DonationCard from '../../components/donations/DonationCard.jsx';
import { Skeleton } from '../../components/common/ui.jsx';
import useCategories from '../../hooks/useCategories.js';

const CAT_ICONS = { fresh_produce: Carrot, packaged: Package, cooked_meals: Utensils, bakery: CakeSlice, dairy: Milk, other: Apple };
const FAQ = [
  ['Who can donate food?', 'Restaurants, grocery stores, bakeries, hotels and event organizers can list surplus food. You confirm a food-safety declaration each time you publish.'],
  ['Who can collect it?', 'Verified NGOs and charities request donations. Some donors accept requests from any signed-in organization; most require verification by our team.'],
  ['Is the food guaranteed safe?', 'No. FoodRescue does not certify food. Donors must follow local food-safety rules, and organizations should inspect food before distributing it. Report any listing that looks unsafe.'],
  ['What does it cost?', 'Nothing is charged by this platform for donors, organizations or volunteers.'],
  ['How does the volunteer handover work?', 'The donor shows a short-lived QR code, the volunteer scans it at pickup, and the organization shows another at delivery. Each code works once.'],
  ['Do you share my exact address?', 'Public pages only show your city or area. The exact address is revealed to the requesting organization and assigned volunteer after you accept a request.'],
];

export default function Home() {
  const nav = useNavigate(); const { categories } = useCategories();
  const stats = useFetch('/analytics/public'); const feat = useFetch('/donations', { params: { limit: 3 } });
  const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const s = stats.data;
  const go = (e) => { e.preventDefault(); nav(`/browse?${new URLSearchParams({ ...(q && { q }), ...(cat && { category: cat }) })}`); };
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>Good Food Should Not Go to Waste</h1>
            <p className="lead">FoodRescue connects restaurants, grocery stores and bakeries with surplus food to verified NGOs and volunteers, so meals reach people instead of landfill.</p>
            <div className="hero-cta"><Link to="/register?role=donor" className="btn btn-lg btn-light">Donate Food</Link><Link to="/browse" className="btn btn-lg btn-secondary" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>Find Food</Link></div>
            <div className="hero-points"><span><CheckCircle2 size={18} />Reduce food waste</span><span><CheckCircle2 size={18} />Support communities</span><span><CheckCircle2 size={18} />Build a sustainable future</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <svg viewBox="0 0 400 300" role="img"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#86efac" /><stop offset="1" stopColor="#22c55e" /></linearGradient></defs>
              <rect x="40" y="170" width="320" height="90" rx="18" fill="#0b2e1d" opacity=".55" /><circle cx="120" cy="150" r="62" fill="#ef4444" /><circle cx="205" cy="125" r="70" fill="#f59e0b" /><circle cx="285" cy="155" r="58" fill="url(#g)" />
              <path d="M205 60c8-22 28-28 40-24-4 16-18 30-40 24z" fill="#16a34a" /><path d="M120 92c-2-14 4-24 14-30 6 12 0 26-14 30z" fill="#15803d" /></svg>
            <div className="hero-chip a"><Truck size={18} color="#15803d" /><div><strong>Pickup in progress</strong><div className="muted">Volunteer on the way</div></div></div>
            <div className="hero-chip b"><Heart size={18} color="#b91c1c" /><div><strong>Meals shared</strong><div className="muted">Sample illustration</div></div></div>
          </div>
        </div>
      </section>

      <div className="container"><form className="search-bar" onSubmit={go} role="search" aria-label="Search available donations">
        <label className="sr-only" htmlFor="h-q">What food are you looking for?</label><input id="h-q" className="input" placeholder="Search bread, rice, vegetables…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="h-c">Food type</label><select id="h-c" className="select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All food types</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
        <button className="btn btn-primary">Search</button></form></div>

      <section className="section container"><div className="section-head"><h2>How it works</h2><p>Four steps from surplus to someone’s plate.</p></div>
        <div className="how">{[[ClipboardCheck, 'List surplus food', 'Businesses post details, quantity, allergens and a pickup window.'], [PackageSearch, 'Find nearby donations', 'Verified organizations search by category, distance and deadline.'], [HandHeart, 'Request and confirm', 'The donor accepts a request and the quantity is reserved.'], [Truck, 'Pick up and deliver', 'The organization collects, or a volunteer delivers with QR-verified handovers.']].map(([I, t, d]) => <div className="card" key={t}><div className="ico"><I size={24} /></div><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></section>

      <section className="section container"><div className="section-head"><h2>Food we help rescue</h2></div>
        <div className="cats">{categories.map((c) => { const I = CAT_ICONS[c.slug] || Apple; return <Link key={c.slug} className="cat" to={`/browse?category=${c.slug}`}><span className="ico"><I size={22} /></span>{c.name}</Link>; })}</div></section>

      <section className="section container"><div className="impact" aria-live="polite">
        {[[s?.completed, 'Completed handovers'], [s ? `${s.weightKg} kg` : null, 'Food weight redistributed'], [s?.servings, 'Estimated servings'], [s?.verifiedOrganizations, 'Verified organizations']].map(([n, l]) => <div key={l}>{stats.loading ? <Skeleton h={32} w={80} /> : <div className="num">{n ?? 0}</div>}<div className="lbl">{l}</div></div>)}</div>
        <p className="small muted" style={{ marginTop: 10 }}>Live totals from confirmed, completed handovers only. Cancelled or expired listings are never counted, and weight is counted only when the donor entered a mass unit.</p></section>

      <section className="section container"><div className="row between"><div className="section-head" style={{ marginBottom: 0 }}><h2>Featured nearby donations</h2></div><Link to="/browse" className="btn btn-secondary">View all <ArrowRight size={16} /></Link></div>
        <div style={{ marginTop: 24 }}>{feat.loading ? <div className="d-grid">{[0, 1, 2].map((i) => <Skeleton key={i} h={300} />)}</div> : feat.data?.donations.length ? <div className="d-grid">{feat.data.donations.map((d) => <DonationCard key={d._id} d={d} />)}</div> : <div className="empty"><h3>No live donations right now</h3><p className="muted">Check back soon, or <Link to="/register?role=donor">post surplus food</Link>.</p></div>}</div></section>

      <section className="section container"><div className="section-head"><h2>Built for everyone in the chain</h2></div>
        <div className="grid-3">{[[Utensils, 'Donors', 'Turn surplus into impact, schedule recurring availability, and track what you have rescued.'], [Heart, 'NGOs and charities', 'Discover verified, nearby food and coordinate pickups in one place.'], [Truck, 'Volunteers', 'Pick up assignments that fit your schedule and verify every handover with a QR code.']].map(([I, t, d]) => <div className="card" key={t}><I size={26} color="#15803d" /><h3 style={{ marginTop: 10 }}>{t}</h3><p className="muted">{d}</p></div>)}</div></section>

      <section className="section container"><div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'auto 1fr', alignItems: 'start' }}><ShieldCheck size={36} color="#15803d" /><div><h2 style={{ fontSize: '1.4rem' }}>Food safety and responsible donation</h2><p className="muted">Donors declare preparation time, storage and allergens. Prepared food has a short collection window, and administrators can suspend any listing for review. FoodRescue does not certify food as safe and does not inspect it; everyone involved must follow local food-safety requirements.</p><Link to="/food-safety">Read the food safety guidelines</Link></div></div></section>

      <section className="section container"><div className="section-head"><h2>What people say</h2><p className="small muted">Sample content for design purposes, not real testimonials.</p></div>
        <div className="grid-3">{[['We cut our end-of-day waste and know exactly where it goes.', 'Sample donor, bakery'], ['Verified listings and clear pickup windows save our team hours.', 'Sample NGO coordinator'], ['The QR handover makes every delivery feel accountable.', 'Sample volunteer']].map(([t, a]) => <blockquote className="card quote" key={a} style={{ margin: 0 }}><p>“{t}”</p><footer>{a}</footer></blockquote>)}</div></section>

      <section className="section container faq"><div className="section-head"><h2>Frequently asked questions</h2></div>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p className="muted" style={{ margin: 0 }}>{a}</p></details>)}</section>
    </>
  );
}
export { FAQ };
