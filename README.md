# Mein Weg zum Millionär

Eigenständige Vite/React-Website für eine private Crowdfunding-Kampagne mit einem Zielbetrag von 1.000.000 EUR.

## Aktueller Stand

- Responsive Kampagnen-Startseite im Navy-/Gold-Design
- Ziel- und Fortschrittsdarstellung
- Vorschau für freiwillige Beiträge (löst ausdrücklich KEINE Zahlung aus)
- Veröffentlichung von Name und Betrag nur mit aktiver Zustimmung
- Transparenzhinweise: privates Crowdfunding, keine Gemeinnützigkeit, keine Rendite oder Gegenleistung
- Supabase-Schema als Ausgangspunkt

## Lokal starten

```bash
npm install
npm run dev
```

## Vercel

Repository mit einem neuen Vercel-Projekt verbinden. Framework Preset: Vite. Build: `npm run build`. Output: `dist`.

Umgebungsvariablen:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nur den öffentlichen anon/publishable key verwenden. Niemals den Supabase service_role key oder Stripe-/PayPal-Geheimnisse als VITE_-Variablen speichern.

## Supabase

Ein neues, ausschließlich für dieses Projekt bestimmtes Supabase-Projekt erstellen und `supabase/schema.sql` im SQL Editor ausführen.

**Noch nicht produktionsbereit:** Vor echten Zahlungen müssen sichere serverseitige Endpunkte / Supabase Edge Functions, Admin-Authentifizierung, RLS-Policies und verifizierte Stripe-/PayPal-Webhooks implementiert und getestet werden. Der öffentliche Browser darf niemals Zahlungen als bestätigt markieren. Die aktuelle Zahlungsmaske ist bewusst nur eine Vorschau und startet keine Transaktion.

## Vor Livegang

1. Österreichische Rechts-/Steuerberatung zur konkreten Einordnung der Beiträge und Meldepflichten einholen.
2. Impressum, Datenschutz, Kontakt und Kampagnenbedingungen mit echten Betreiberangaben ergänzen.
3. Stripe-/PayPal-Konten einrichten und Webhooks serverseitig verifizieren.
4. Banküberweisungsprozess und Abgleich definieren.
5. Adminbereich mit serverseitiger Autorisierung und Audit-Log ergänzen.
6. Sicherheits- und Zahlungstests durchführen.
