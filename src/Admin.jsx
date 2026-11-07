import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, LogIn, LogOut, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import './admin.css';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://lffbqcqmrftlmjottzcf.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const db = key ? createClient(url, key) : null;
const euro = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });

export default function Admin() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [amount, setAmount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [provider, setProvider] = useState('manual');
  const [status, setStatus] = useState('confirmed');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let live = true;
    async function load() {
      if (!db || !session) { setIsAdmin(false); return; }
      const { data: grant, error: grantError } = await db.from('campaign_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (!live) return;
      if (grantError || !grant) { setIsAdmin(false); setMessage('Dieses Konto ist noch nicht als Kampagnen-Administrator freigeschaltet.'); return; }
      setIsAdmin(true);
      const [c, u] = await Promise.all([
        db.from('contributions').select('id, amount, payment_provider, payment_status, display_name, publish_consent, created_at, confirmed_at').order('created_at', { ascending: false }).limit(100),
        db.from('campaign_updates').select('id, title, body, is_published, published_at, created_at').order('created_at', { ascending: false }).limit(50)
      ]);
      if (!live) return;
      if (c.error) setMessage(c.error.message); else setContributions(c.data || []);
      if (u.error) setMessage(u.error.message); else setUpdates(u.data || []);
    }
    load();
    return () => { live = false; };
  }, [session]);

  async function signIn(e) {
    e.preventDefault(); if (!db) { setMessage('Der öffentliche Supabase-Schlüssel fehlt noch in Vercel.'); return; }
    setBusy(true); setMessage('');
    const { error } = await db.auth.signInWithPassword({ email, password });
    setBusy(false); if (error) setMessage(error.message);
  }
  async function signOut() { await db?.auth.signOut(); setIsAdmin(false); setContributions([]); setUpdates([]); }
  async function addContribution(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setMessage('Bitte einen gültigen Betrag eingeben.'); setBusy(false); return; }
    const row = { amount: value, payment_provider: provider, payment_status: status, display_name: displayName.trim() || null, publish_consent: false, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null };
    const { data, error } = await db.from('contributions').insert(row).select('id').single();
    if (error) setMessage(error.message);
    else {
      await db.from('campaign_audit_log').insert({ action: 'create', entity: 'contribution', entity_id: data.id, details: { amount: value, payment_provider: provider, payment_status: status } });
      setAmount(''); setDisplayName(''); await reload();
      setMessage('Eintrag gespeichert. Öffentliche Anzeige bleibt standardmäßig anonym.');
    }
    setBusy(false);
  }
  async function setContributionStatus(row, nextStatus) {
    setBusy(true);
    const patch = { payment_status: nextStatus, confirmed_at: nextStatus === 'confirmed' ? new Date().toISOString() : null };
    const { error } = await db.from('contributions').update(patch).eq('id', row.id);
    if (error) setMessage(error.message);
    else {
      await db.from('campaign_audit_log').insert({ action: 'status_change', entity: 'contribution', entity_id: row.id, details: { from: row.payment_status, to: nextStatus } });
      await reload();
    }
    setBusy(false);
  }
  async function addUpdate(e) {
    e.preventDefault(); setBusy(true);
    const { data, error } = await db.from('campaign_updates').insert({ title: title.trim(), body: body.trim(), is_published: false }).select('id').single();
    if (error) setMessage(error.message);
    else { await db.from('campaign_audit_log').insert({ action: 'create', entity: 'campaign_update', entity_id: data.id, details: { title } }); setTitle(''); setBody(''); await reload(); setMessage('Neuigkeit als Entwurf gespeichert.'); }
    setBusy(false);
  }
  async function toggleUpdate(item) {
    setBusy(true);
    const next = !item.is_published;
    const { error } = await db.from('campaign_updates').update({ is_published: next, published_at: next ? new Date().toISOString() : null }).eq('id', item.id);
    if (error) setMessage(error.message);
    else { await db.from('campaign_audit_log').insert({ action: next ? 'publish' : 'unpublish', entity: 'campaign_update', entity_id: item.id, details: { title: item.title } }); await reload(); }
    setBusy(false);
  }
  async function reload() {
    const [c, u] = await Promise.all([
      db.from('contributions').select('id, amount, payment_provider, payment_status, display_name, publish_consent, created_at, confirmed_at').order('created_at', { ascending: false }).limit(100),
      db.from('campaign_updates').select('id, title, body, is_published, published_at, created_at').order('created_at', { ascending: false }).limit(50)
    ]);
    if (!c.error) setContributions(c.data || []);
    if (!u.error) setUpdates(u.data || []);
  }

  if (!session) return <main className="admin-page"><a className="admin-back" href="/"><ArrowLeft size={16}/> Zur Website</a><section className="admin-login"><div className="admin-icon"><ShieldCheck/></div><p className="admin-kicker">GESCHÜTZTER BEREICH</p><h1>Kampagnen-<em>Verwaltung</em></h1><p>Melde dich mit deinem freigeschalteten Administrator-Konto an.</p><form onSubmit={signIn}><label>E-Mail-Adresse<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Passwort<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="admin-primary" disabled={busy}><LogIn size={16}/> Anmelden</button></form>{message && <div className="admin-message">{message}</div>}{!key && <div className="admin-message">VITE_SUPABASE_ANON_KEY fehlt noch in den Vercel-Variablen.</div>}</section></main>;

  if (!isAdmin) return <main className="admin-page"><section className="admin-login"><div className="admin-icon"><ShieldCheck/></div><h1>Zugriff <em>nicht freigegeben</em></h1><p>Dein Konto ist angemeldet, aber noch nicht in der Administrator-Freigabeliste.</p>{message && <div className="admin-message">{message}</div>}<button className="admin-primary" onClick={signOut}><LogOut size={16}/> Abmelden</button><a className="admin-back" href="/">Zur Website</a></section></main>;

  const confirmed = contributions.filter(x=>x.payment_status==='confirmed').reduce((sum,x)=>sum+Number(x.amount),0);
  return <main className="admin-page"><header className="admin-header"><a className="admin-back" href="/"><ArrowLeft size={16}/> Zur Website</a><div><span className="admin-kicker">ADMINISTRATOR</span><h1>Kampagnen-<em>Verwaltung</em></h1></div><button className="admin-logout" onClick={signOut}><LogOut size={16}/> Abmelden</button></header>
    {message && <div className="admin-message wide">{message}</div>}
    <section className="admin-metrics"><article><span>Bestätigte Beiträge</span><strong>{euro.format(confirmed)}</strong></article><article><span>Alle Einträge</span><strong>{contributions.length}</strong></article><article><span>Neuigkeiten</span><strong>{updates.length}</strong></article></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Beitrag manuell erfassen</h2><span>Nur für bereits extern bestätigte Zahlungen oder Bankabgleich</span></div><form className="admin-form" onSubmit={addContribution}><label>Betrag in EUR<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>Anzeigename (intern)<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Optional"/></label><label>Zahlungsart<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="manual">Manuell</option><option value="bank_transfer">Banküberweisung</option><option value="stripe">Stripe (extern bestätigt)</option><option value="paypal">PayPal (extern bestätigt)</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="confirmed">Bestätigt</option><option value="pending">Ausstehend</option><option value="refunded">Rückerstattet</option><option value="cancelled">Storniert</option></select></label><button className="admin-primary" disabled={busy}><Plus size={16}/> Beitrag speichern</button></form></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Beiträge</h2><button className="admin-refresh" onClick={reload}><RefreshCw size={14}/> Aktualisieren</button></div><div className="admin-table-wrap"><table><thead><tr><th>Datum</th><th>Betrag</th><th>Zahlungsart</th><th>Status</th><th>Name</th><th>Aktion</th></tr></thead><tbody>{contributions.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleDateString('de-AT')}</td><td>{euro.format(Number(row.amount))}</td><td>{row.payment_provider}</td><td><span className={'status status-'+row.payment_status}>{row.payment_status}</span></td><td>{row.display_name || 'Anonym'}</td><td><select aria-label="Beitragsstatus ändern" value={row.payment_status} disabled={busy} onChange={e=>setContributionStatus(row,e.target.value)}><option value="pending">Ausstehend</option><option value="confirmed">Bestätigt</option><option value="failed">Fehlgeschlagen</option><option value="refunded">Rückerstattet</option><option value="cancelled">Storniert</option></select></td></tr>)}</tbody></table></div></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Neuigkeit erstellen</h2><span>Neue Einträge starten als Entwurf</span></div><form className="admin-form admin-news-form" onSubmit={addUpdate}><label>Titel<input value={title} onChange={e=>setTitle(e.target.value)} required/></label><label>Text<textarea value={body} onChange={e=>setBody(e.target.value)} rows="3" required/></label><button className="admin-primary" disabled={busy}><Plus size={16}/> Entwurf speichern</button></form><div className="admin-updates">{updates.map(item=><article key={item.id}><div><b>{item.title}</b><p>{item.body}</p><small>{item.is_published?'Veröffentlicht':'Entwurf'}</small></div><button className="admin-refresh" disabled={busy} onClick={()=>toggleUpdate(item)}>{item.is_published?'Zurückziehen':'Veröffentlichen'}</button></article>)}</div></section>
    <p className="admin-footnote">Alle Verwaltungsaktionen erfordern eine serverseitig geprüfte Administrator-Freigabe. Manuelle Einträge nur nach tatsächlichem Zahlungseingang bestätigen.</p>
  </main>;
}
