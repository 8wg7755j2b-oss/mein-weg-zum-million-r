import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Download, LogIn, LogOut, Plus, RefreshCw, Save, ShieldCheck } from 'lucide-react';
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
  const [checkedGrant, setCheckedGrant] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [audit, setAudit] = useState([]);
  const [amount, setAmount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [provider, setProvider] = useState('manual');
  const [status, setStatus] = useState('confirmed');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [goal, setGoal] = useState('1000000');
  const [heroIntro, setHeroIntro] = useState('');
  const [purposeText, setPurposeText] = useState('');

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let live = true;
    async function load() {
      setCheckedGrant(false);
      if (!db || !session) { setIsAdmin(false); setCheckedGrant(true); return; }
      const { data: grant, error: grantError } = await db.from('campaign_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (!live) return;
      if (grantError || !grant) {
        setIsAdmin(false);
        setMessage(grantError?.message || 'Dieses Konto ist noch nicht als Kampagnen-Administrator freigeschaltet.');
        setCheckedGrant(true);
        return;
      }
      setIsAdmin(true);
      await reload();
      setCheckedGrant(true);
    }
    load();
    return () => { live = false; };
  }, [session]);

  async function signIn(e) {
    e.preventDefault();
    if (!db) { setMessage('Der öffentliche Supabase-Schlüssel fehlt noch in Vercel.'); return; }
    setBusy(true); setMessage('');
    const { error } = await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
  }
  async function signOut() { await db?.auth.signOut(); setIsAdmin(false); setContributions([]); setUpdates([]); setAudit([]); }
  async function reload() {
    if (!db) return;
    const [c, u, s, a] = await Promise.all([
      db.from('contributions').select('id, amount, payment_provider, payment_status, display_name, publish_consent, created_at, confirmed_at, provider_reference').order('created_at', { ascending: false }).limit(1000),
      db.from('campaign_updates').select('id, title, body, is_published, published_at, created_at').order('created_at', { ascending: false }).limit(100),
      db.from('campaign_settings').select('goal_amount, hero_intro, purpose_text').eq('id', true).maybeSingle(),
      db.from('campaign_audit_log').select('id, action, entity, entity_id, details, created_at').order('created_at', { ascending: false }).limit(100)
    ]);
    if (c.error) setMessage(c.error.message); else setContributions(c.data || []);
    if (u.error) setMessage(u.error.message); else setUpdates(u.data || []);
    if (s.error) setMessage(s.error.message);
    else if (s.data) {
      setGoal(String(s.data.goal_amount));
      setHeroIntro(s.data.hero_intro || '');
      setPurposeText(s.data.purpose_text || '');
    }
    if (a.error) setMessage(a.error.message); else setAudit(a.data || []);
  }
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
    if (!window.confirm('Status wirklich ändern? Das löst keine echte Rückerstattung beim Zahlungsanbieter aus.')) return;
    setBusy(true);
    const patch = { payment_status: nextStatus, confirmed_at: nextStatus === 'confirmed' ? new Date().toISOString() : null };
    const { error } = await db.from('contributions').update(patch).eq('id', row.id);
    if (error) setMessage(error.message);
    else {
      await db.from('campaign_audit_log').insert({ action: 'status_change', entity: 'contribution', entity_id: row.id, details: { from: row.payment_status, to: nextStatus } });
      await reload();
      setMessage('Status aktualisiert. Bei Rückerstattungen muss der Vorgang zusätzlich beim Zahlungsanbieter erfolgen.');
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
  async function saveSettings(e) {
    e.preventDefault();
    const parsedGoal = Number(goal);
    if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) { setMessage('Das Kampagnenziel muss größer als 0 sein.'); return; }
    setBusy(true); setMessage('');
    const { error } = await db.from('campaign_settings').update({ goal_amount: parsedGoal, hero_intro: heroIntro.trim(), purpose_text: purposeText.trim(), updated_at: new Date().toISOString() }).eq('id', true);
    if (error) setMessage(error.message);
    else {
      await db.from('campaign_audit_log').insert({ action: 'update', entity: 'campaign_settings', details: { goal_amount: parsedGoal } });
      await reload(); setMessage('Kampagneneinstellungen gespeichert.');
    }
    setBusy(false);
  }
  function exportCsv() {
    const columns = ['created_at','amount','payment_provider','payment_status','display_name','publish_consent','provider_reference','id'];
    const quote = value => { const raw = String(value ?? ''); const first = raw.charCodeAt(0); const safe = [61, 43, 45, 64, 9, 13].includes(first) ? "'" + raw : raw; return '"' + safe.replaceAll('"', '""') + '"'; };
    const csv = [columns.join(';'), ...contributions.map(row => columns.map(key => quote(row[key])).join(';'))].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href; link.download = 'kampagnen-beitraege.csv'; link.click();
    URL.revokeObjectURL(href);
  }

  if (!session) return <main className="admin-page"><a className="admin-back" href="/"><ArrowLeft size={16}/> Zur Website</a><section className="admin-login"><div className="admin-icon"><ShieldCheck/></div><p className="admin-kicker">GESCHÜTZTER BEREICH</p><h1>Kampagnen-<em>Verwaltung</em></h1><p>Melde dich mit deinem freigeschalteten Administrator-Konto an.</p><form onSubmit={signIn}><label>E-Mail-Adresse<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Passwort<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="admin-primary" disabled={busy}><LogIn size={16}/> Anmelden</button></form>{message && <div className="admin-message">{message}</div>}{!key && <div className="admin-message">VITE_SUPABASE_ANON_KEY fehlt noch in den Vercel-Variablen.</div>}</section></main>;
  if (!checkedGrant) return <main className="admin-page"><section className="admin-login"><p>Administrator-Freigabe wird geprüft …</p></section></main>;
  if (!isAdmin) return <main className="admin-page"><section className="admin-login"><div className="admin-icon"><ShieldCheck/></div><h1>Zugriff <em>nicht freigegeben</em></h1><p>Dein Konto ist angemeldet, aber noch nicht in der Administrator-Freigabeliste.</p>{message && <div className="admin-message">{message}</div>}<button className="admin-primary" onClick={signOut}><LogOut size={16}/> Abmelden</button><a className="admin-back" href="/">Zur Website</a></section></main>;

  const confirmed = contributions.filter(x=>x.payment_status==='confirmed').reduce((sum,x)=>sum+Number(x.amount),0);
  const pending = contributions.filter(x=>x.payment_status==='pending').length;
  return <main className="admin-page"><header className="admin-header"><a className="admin-back" href="/"><ArrowLeft size={16}/> Zur Website</a><div><span className="admin-kicker">ADMINISTRATOR</span><h1>Kampagnen-<em>Verwaltung</em></h1></div><button className="admin-logout" onClick={signOut}><LogOut size={16}/> Abmelden</button></header>
    {message && <div className="admin-message wide">{message}</div>}
    <section className="admin-metrics"><article><span>Bestätigte Beiträge</span><strong>{euro.format(confirmed)}</strong></article><article><span>Alle geladenen Einträge</span><strong>{contributions.length}</strong></article><article><span>Ausstehend</span><strong>{pending}</strong></article></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Kampagne bearbeiten</h2><span>Öffentliche Startseite</span></div><form className="admin-form admin-settings-form" onSubmit={saveSettings}><label>Zielbetrag in EUR<input type="number" min="1" step="0.01" value={goal} onChange={e=>setGoal(e.target.value)} required/></label><label className="wide-field">Einleitungstext<textarea rows="3" value={heroIntro} onChange={e=>setHeroIntro(e.target.value)}/></label><label className="wide-field">Zweckdarstellung<textarea rows="3" value={purposeText} onChange={e=>setPurposeText(e.target.value)}/></label><button className="admin-primary" disabled={busy}><Save size={16}/> Änderungen speichern</button></form></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Beitrag manuell erfassen</h2><span>Nur nach extern bestätigtem Zahlungseingang oder Bankabgleich</span></div><form className="admin-form" onSubmit={addContribution}><label>Betrag in EUR<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>Anzeigename (intern)<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Optional"/></label><label>Zahlungsart<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="manual">Manuell</option><option value="bank_transfer">Banküberweisung</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="confirmed">Bestätigt</option><option value="pending">Ausstehend</option><option value="refunded">Rückerstattet</option><option value="cancelled">Storniert</option></select></label><button className="admin-primary" disabled={busy}><Plus size={16}/> Beitrag speichern</button></form></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Beiträge</h2><div className="admin-actions"><button className="admin-refresh" onClick={reload}><RefreshCw size={14}/> Aktualisieren</button><button className="admin-refresh" onClick={exportCsv}><Download size={14}/> CSV exportieren</button></div></div><div className="admin-table-wrap"><table><thead><tr><th>Datum</th><th>Betrag</th><th>Zahlungsart</th><th>Status</th><th>Name (intern)</th><th>Aktion</th></tr></thead><tbody>{contributions.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleDateString('de-AT')}</td><td>{euro.format(Number(row.amount))}</td><td>{row.payment_provider}</td><td><span className={'status status-'+row.payment_status}>{row.payment_status}</span></td><td>{row.display_name || 'Anonym'}</td><td>{(row.payment_provider === 'stripe' || row.payment_provider === 'paypal') ? <small>Webhook-gesteuert</small> : <select aria-label="Beitragsstatus ändern" value={row.payment_status} disabled={busy} onChange={e=>setContributionStatus(row,e.target.value)}><option value="pending">Ausstehend</option><option value="confirmed">Bestätigt</option><option value="failed">Fehlgeschlagen</option><option value="refunded">Rückerstattet</option><option value="cancelled">Storniert</option></select>}</td></tr>)}</tbody></table></div><p className="admin-footnote">CSV enthält die aktuell geladenen letzten 1.000 Datensätze. Eine Statusänderung ersetzt keine tatsächliche Rückerstattung.</p></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Neuigkeit erstellen</h2><span>Neue Einträge starten als Entwurf</span></div><form className="admin-form admin-news-form" onSubmit={addUpdate}><label>Titel<input value={title} onChange={e=>setTitle(e.target.value)} required/></label><label>Text<textarea value={body} onChange={e=>setBody(e.target.value)} rows="3" required/></label><button className="admin-primary" disabled={busy}><Plus size={16}/> Entwurf speichern</button></form><div className="admin-updates">{updates.map(item=><article key={item.id}><div><b>{item.title}</b><p>{item.body}</p><small>{item.is_published?'Veröffentlicht':'Entwurf'}</small></div><button className="admin-refresh" disabled={busy} onClick={()=>toggleUpdate(item)}>{item.is_published?'Zurückziehen':'Veröffentlichen'}</button></article>)}</div></section>
    <section className="admin-panel"><div className="admin-panel-head"><h2>Letzte Verwaltungsaktionen</h2><button className="admin-refresh" onClick={reload}><RefreshCw size={14}/> Aktualisieren</button></div><div className="admin-table-wrap"><table><thead><tr><th>Zeitpunkt</th><th>Aktion</th><th>Bereich</th><th>Details</th></tr></thead><tbody>{audit.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('de-AT')}</td><td>{row.action}</td><td>{row.entity}</td><td>{JSON.stringify(row.details)}</td></tr>)}</tbody></table></div></section>
    <p className="admin-footnote">Zugriff nur für freigeschaltete Konten. Öffentliche Namen werden nie durch manuelle Erfassung freigegeben. Zahlungsstatus und echte Zahlung/Rückerstattung sind getrennte Vorgänge.</p>
  </main>;
}
