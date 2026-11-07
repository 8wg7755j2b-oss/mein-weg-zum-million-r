import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ArrowDownRight, ArrowRight, CheckCircle2, HeartHandshake, LockKeyhole, Menu, ShieldCheck, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import './style.css';

const GOAL = 1_000_000;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lffbqcqmrftlmjottzcf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const money = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function App() {
  const [raised, setRaised] = useState(0);
  const [count, setCount] = useState(0);
  const [updates, setUpdates] = useState([]);
  const [supporters, setSupporters] = useState([]);
  const [amount, setAmount] = useState('25');
  const [name, setName] = useState('');
  const [publicConsent, setPublicConsent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const percent = useMemo(() => Math.min(100, (raised / GOAL) * 100), [raised]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    async function loadCampaign() {
      const [{ data: totals }, { data: publicSupporters }, { data: news }] = await Promise.all([
        supabase.rpc('public_campaign_totals'),
        supabase.rpc('public_supporters'),
        supabase.from('campaign_updates').select('id, title, body, published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(5)
      ]);
      if (!active) return;
      if (totals?.[0]) { setRaised(Number(totals[0].confirmed_total || 0)); setCount(Number(totals[0].supporter_count || 0)); }
      if (publicSupporters) setSupporters(publicSupporters.slice(0, 8));
      if (news) setUpdates(news);
    }
    loadCampaign();
    return () => { active = false; };
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitInterest = (e) => {
    e.preventDefault();
    setNotice('Die Zahlungsfunktion wird gerade eingerichtet. Es wurde keine Zahlung ausgelöst und keine Zahlungszusage gespeichert.');
  };

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Startseite"><span className="brand-mark">M</span><span>MEIN WEG <i>ZUM MILLIONÄR</i></span></a>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü öffnen">{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'nav nav-open' : 'nav'}>
          <button onClick={() => scrollTo('geschichte')}>Die Idee</button>
          <button onClick={() => scrollTo('fortschritt')}>Fortschritt</button>
          <button onClick={() => scrollTo('transparenz')}>Transparenz</button>
          <button className="nav-cta" onClick={() => scrollTo('unterstuetzen')}>Unterstützen <ArrowRight size={16}/></button>
        </nav>
      </header>

      <main id="home">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line"/> EIN PERSÖNLICHES CROWDFUNDING-PROJEKT</div>
            <h1>Eine Million.<br/><em>Ein Ziel.</em><br/>Mein Weg.</h1>
            <p className="hero-lead">Ich teile ein großes persönliches Ziel – den Aufbau eines Vermögens von einer Million Euro. Wer diesen Weg freiwillig unterstützen möchte, kann Teil der Reise werden.</p>
            <div className="hero-actions">
              <button className="button button-gold" onClick={() => scrollTo('unterstuetzen')}>Projekt unterstützen <ArrowRight size={17}/></button>
              <button className="text-button" onClick={() => scrollTo('geschichte')}>Mehr erfahren <ArrowDownRight size={17}/></button>
            </div>
            <div className="hero-note"><ShieldCheck size={16}/> Offen kommuniziert. Freiwillig. Ohne Renditeversprechen.</div>
          </div>
          <div className="hero-art" aria-label="Abstrakte goldene Zielscheibe">
            <div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/>
            <div className="target-core"><Target size={54} strokeWidth={1.1}/><span>1M</span></div>
            <div className="floating-card"><Sparkles size={17}/><span>Ein Ziel vor Augen</span></div>
            <div className="vertical-label">VISION · DISZIPLIN · WEG</div>
          </div>
        </section>

        <section className="stats section-wrap" id="fortschritt">
          <div className="stat-label"><span>DER AKTUELLE STAND</span><span className="live-dot"/> <small>{supabase ? 'LIVE-DATEN' : 'VORSCHAU'}</small></div>
          <div className="progress-heading"><div><span className="muted">Bisher erreicht</span><strong>{money.format(raised)}</strong></div><div className="goal-value"><span className="muted">Mein Ziel</span><strong>{money.format(GOAL)}</strong></div></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: percent + '%' }}/></div>
          <div className="progress-foot"><span>{percent.toFixed(2).replace('.', ',')} % erreicht</span><span>{money.format(Math.max(0, GOAL - raised))} bis zum Ziel</span></div>
          <div className="stat-bottom"><div><TrendingUp/><span><b>{count}</b> bestätigte Unterstützungen</span></div><span className="muted">Aktualisierung nach Zahlungsbestätigung</span></div>
        </section>

        <section className="story section-wrap" id="geschichte">
          <div className="section-kicker">01 / DIE IDEE</div>
          <div className="story-grid"><h2>Ein persönliches Ziel.<br/><em>Ein offener Weg.</em></h2><div><p>„Mein Weg zum Millionär“ ist ein privates Crowdfunding-Projekt. Ich möchte meinen persönlichen Vermögensaufbau transparent dokumentieren und Menschen die Möglichkeit geben, mich freiwillig dabei zu unterstützen.</p><p>Jeder Beitrag ist freiwillig. Es gibt dafür keine Beteiligung, keine Verzinsung, keine Rückzahlung und keinen Anspruch auf eine Gegenleistung.</p></div></div>
        </section>

        <section className="support-section" id="unterstuetzen">
          <div className="section-wrap support-grid">
            <div><div className="section-kicker">02 / MITGEHEN</div><h2>Wenn du möchtest,<br/><em>unterstütze den Weg.</em></h2><p>Wähle einen Betrag als unverbindliche Vorschau. Die sichere Zahlungsabwicklung wird erst nach Einrichtung und Prüfung der Zahlungsanbieter freigeschaltet.</p><div className="secure-note"><LockKeyhole size={17}/> Keine Zahlungsdaten werden auf dieser Vorschauseite abgefragt.</div></div>
            <form className="donate-card" onSubmit={submitInterest}>
              <div className="card-top"><HeartHandshake/><span>FREIWILLIGE UNTERSTÜTZUNG</span></div>
              <label>Beitragsbetrag</label>
              <div className="amount-options">{['10','25','50','100'].map(v => <button type="button" key={v} className={amount === v ? 'amount active' : 'amount'} onClick={() => setAmount(v)}>{v} €</button>)}</div>
              <div className="amount-input"><span>€</span><input aria-label="Eigener Betrag in Euro" type="number" min="1" max="100000" step="1" value={amount} onChange={e => setAmount(e.target.value)} required/></div>
              <label className="field-label">Anzeigename (optional)</label><input className="name-input" value={name} onChange={e => setName(e.target.value)} placeholder="Wie darf ich dich nennen?"/>
              <label className="consent"><input type="checkbox" checked={publicConsent} onChange={e => setPublicConsent(e.target.checked)}/><span>Ich möchte, dass mein Name und mein Beitrag nach erfolgreicher Zahlung öffentlich angezeigt werden. Ohne Zustimmung bleibe ich anonym.</span></label>
              <button className="button button-gold full" type="submit">Weiter zur Unterstützung <ArrowRight size={17}/></button>
              {notice && <p className="notice" role="status">{notice}</p>}
              <p className="fine-print">Noch keine Zahlung möglich. Die Betragseingabe ist derzeit nur eine Vorschau und löst keine Transaktion aus.</p>
            </form>
          </div>
        </section>

        <section className="transparency section-wrap" id="transparenz">
          <div className="section-kicker">03 / KLARHEIT</div><h2>Transparenz ist <em>die Grundlage.</em></h2>
          <div className="principles"><article><ShieldCheck/><h3>Privates Vorhaben</h3><p>Dies ist eine persönliche Crowdfunding-Kampagne und keine gemeinnützige Spendenaktion.</p></article><article><LockKeyhole/><h3>Freiwillig & ohne Rendite</h3><p>Beiträge begründen weder eine Geldanlage noch einen Anspruch auf Gewinn, Zinsen oder Rückzahlung.</p></article><article><CheckCircle2/><h3>Öffentlich nur mit Ja</h3><p>Name und Betrag werden nur nach ausdrücklicher Zustimmung veröffentlicht. Sonst bleibt die Unterstützung anonym.</p></article></div>
        </section>

        {updates.length > 0 && <section className="updates section-wrap"><div className="section-kicker">04 / NEUIGKEITEN</div><h2>Einblicke auf <em>dem Weg.</em></h2><div className="update-list">{updates.map(u => <article key={u.id}><time>{new Date(u.published_at).toLocaleDateString('de-AT')}</time><h3>{u.title}</h3><p>{u.body}</p></article>)}</div></section>}
        {supporters.length > 0 && <section className="supporters section-wrap"><div className="section-kicker">05 / GEMEINSAM</div><h2>Menschen, die <em>mitgehen.</em></h2><div className="supporter-list">{supporters.map((s,i)=><div key={i}><span>{s.display_name}</span><b>{money.format(Number(s.amount))}</b></div>)}</div></section>}
      </main>
      <footer className="footer"><div className="section-wrap footer-inner"><a className="brand" href="#home"><span className="brand-mark">M</span><span>MEIN WEG <i>ZUM MILLIONÄR</i></span></a><p>Ein persönliches Crowdfunding-Projekt. Keine Anlage, keine Rendite, keine gemeinnützige Spendenaktion.</p><div><a href="mailto:kontakt@example.invalid">Kontakt</a><a href="#transparenz">Transparenz</a><a href="#rechtliches">Rechtliches</a></div><small>© {new Date().getFullYear()} Mein Weg zum Millionär</small></div></footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
