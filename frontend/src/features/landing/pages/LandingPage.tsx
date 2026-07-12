import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Check,
  ClipboardCheck,
  Menu,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const workflows = [
  { icon: Boxes, label: "Asset custody", detail: "Know what you own, where it is, and who is responsible." },
  { icon: BookOpenCheck, label: "Shared bookings", detail: "Give teams a clear view of availability without double-booking." },
  { icon: Wrench, label: "Maintenance", detail: "Move every request from reported to resolved with a complete record." },
  { icon: ClipboardCheck, label: "Audits", detail: "Run accountable checks without spreadsheets or fragmented follow-ups." },
];

function BrandMark() {
  return (
    <span className="landing-brand" aria-label="AssetFlow home">
      <span className="landing-brand-mark" aria-hidden="true"><span /></span>
      <span>AssetFlow</span>
    </span>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <Link to="/" className="landing-brand-link"><BrandMark /></Link>
          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#workflows">Workflows</a>
            <a href="#security">Security</a>
          </nav>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-link-button">Sign in</Link>
            <Link to="/signup" className="landing-button landing-button-small">Start free <ArrowRight aria-hidden="true" /></Link>
          </div>
          <button className="landing-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <nav className="landing-mobile-menu" aria-label="Mobile navigation">
            <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
            <a href="#workflows" onClick={() => setMenuOpen(false)}>Workflows</a>
            <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
            <Link to="/login">Sign in</Link>
            <Link to="/signup" className="landing-button">Start free <ArrowRight /></Link>
          </nav>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <div className="landing-kicker"><span /> Operations, finally in order</div>
              <h1>Every asset.<br />One clear <em>story.</em></h1>
              <p>AssetFlow gives your team a dependable system for custody, bookings, maintenance, and audits—without the ERP clutter.</p>
              <div className="landing-hero-actions">
                <Link to="/signup" className="landing-button">Start organizing <ArrowRight aria-hidden="true" /></Link>
                <a href="#product" className="landing-text-link">See how it works <span aria-hidden="true">↓</span></a>
              </div>
              <div className="landing-proof-line">
                <span><Check aria-hidden="true" /> No credit card</span>
                <span><Check aria-hidden="true" /> Set up in minutes</span>
              </div>
            </div>

            <div className="landing-product-frame" id="product" aria-label="AssetFlow product preview">
              <div className="landing-product-topbar">
                <span className="landing-mini-brand"><span className="landing-brand-mark" aria-hidden="true"><span /></span> AssetFlow</span>
                <span className="landing-avatar">NS</span>
              </div>
              <div className="landing-product-body">
                <aside className="landing-product-sidebar" aria-hidden="true">
                  <span className="active"><Boxes /> Assets</span><span><BookOpenCheck /> Bookings</span><span><Wrench /> Maintenance</span><span><ClipboardCheck /> Audits</span>
                </aside>
                <div className="landing-product-content">
                  <div className="landing-product-heading"><div><small>ASSET DIRECTORY</small><strong>Everything accounted for.</strong></div><button>+ Add asset</button></div>
                  <div className="landing-stat-row">
                    <div><small>Total assets</small><strong>1,248</strong><span>Across 8 departments</span></div>
                    <div><small>Available</small><strong>892</strong><span className="positive">71.5% ready</span></div>
                    <div><small>Needs attention</small><strong>18</strong><span>4 overdue checks</span></div>
                  </div>
                  <div className="landing-table">
                    <div className="landing-table-head"><span>Asset</span><span>Assigned to</span><span>Status</span></div>
                    <div><span><i className="asset-icon"><Boxes /></i><b>MacBook Pro 14”</b><small>AST-2048</small></span><span>Priya Shah</span><span><i className="status available" /> In use</span></div>
                    <div><span><i className="asset-icon"><Boxes /></i><b>Epson Projector</b><small>AST-1842</small></span><span>Media Lab</span><span><i className="status ready" /> Available</span></div>
                    <div><span><i className="asset-icon"><Boxes /></i><b>Patient Monitor</b><small>AST-1631</small></span><span>Ward 4B</span><span><i className="status attention" /> Maintenance</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="Ideal teams">
          <div className="landing-container"><span>BUILT FOR THE PEOPLE WHO KEEP THINGS RUNNING</span><div><b>Schools</b><b>Hospitals</b><b>Offices</b><b>Factories</b></div></div>
        </section>

        <section className="landing-workflows landing-container" id="workflows">
          <div className="landing-section-heading">
            <span>ONE OPERATIONAL RECORD</span>
            <h2>Less chasing.<br />More knowing.</h2>
            <p>Replace handoffs, side spreadsheets, and “who has it?” messages with a shared source of truth.</p>
          </div>
          <div className="landing-workflow-list">
            {workflows.map(({ icon: Icon, label, detail }, index) => (
              <article key={label}><span className="landing-workflow-number">0{index + 1}</span><Icon aria-hidden="true" /><div><h3>{label}</h3><p>{detail}</p></div><ArrowRight aria-hidden="true" /></article>
            ))}
          </div>
        </section>

        <section className="landing-security" id="security">
          <div className="landing-container landing-security-grid">
            <div><span className="landing-security-icon"><ShieldCheck /></span><span className="landing-eyebrow">CONTROL WITHOUT FRICTION</span><h2>The right access.<br />A complete history.</h2></div>
            <div className="landing-security-copy"><p>AssetFlow keeps permissions predictable and sensitive changes visible, so administrators stay in control without slowing everyone else down.</p><ul><li><Check /> Role-based access</li><li><Check /> Activity history</li><li><Check /> Clear approval states</li><li><Check /> Audit-ready records</li></ul></div>
          </div>
        </section>

        <section className="landing-final-cta landing-container">
          <div className="landing-final-copy"><Sparkles aria-hidden="true" /><h2>Put every asset<br />in its place.</h2></div>
          <div><p>Start with your team today. Build a calmer operation tomorrow.</p><Link to="/signup" className="landing-button landing-button-light">Create your workspace <ArrowRight /></Link></div>
        </section>
      </main>

      <footer className="landing-footer landing-container"><BrandMark /><p>Asset operations, made clear.</p><span>© 2026 AssetFlow</span></footer>
    </div>
  );
}
