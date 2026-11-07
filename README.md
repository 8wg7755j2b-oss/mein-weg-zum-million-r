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


## Adminbereich

- Aufruf über `/admin`
- Anmeldung über Supabase Auth (E-Mail/Passwort)
- Zugriff nur für explizit in `public.campaign_admins` freigeschaltete Benutzer
- Beiträge manuell erfassen und Zahlungsstatus verwalten
- Kampagnen-Neuigkeiten als Entwurf anlegen und veröffentlichen
- Verwaltungsaktionen werden im Audit-Log protokolliert\n- Kampagnenziel und öffentliche Einleitungstexte bearbeiten\n- CSV-Export der letzten 1.000 geladenen Beitragseinträge\n- Letzte Verwaltungsaktionen im Adminbereich einsehen

### Admin einmalig freischalten

1. In Supabase unter **Authentication → Users** einen Benutzer für den Betreiber anlegen.
2. In **SQL Editor** die Datei `supabase/admin_setup.sql` ausführen.\n3. Danach die Datei `supabase/campaign_settings.sql` ausführen, damit Zielbetrag und öffentliche Texte bearbeitbar sind.
4. Danach in SQL Editor die folgende Abfrage ausführen und die E-Mail durch die eigene Login-Adresse ersetzen:

```sql
insert into public.campaign_admins (user_id)
select id from auth.users where email = 'DEINE-LOGIN-EMAIL';
```

5. In Vercel muss zusätzlich `VITE_SUPABASE_ANON_KEY` als Environment Variable gesetzt sein.
6. Danach unter `https://DEINE-DOMAIN/admin` anmelden.

Die Admin-Freigabe darf ausschließlich im Supabase SQL Editor erfolgen. Niemals einen Service-Role-Key im Browser verwenden.

## Vor Livegang

1. Österreichische Rechts-/Steuerberatung zur konkreten Einordnung der Beiträge und Meldepflichten einholen.
2. Impressum, Datenschutz, Kontakt und Kampagnenbedingungen mit echten Betreiberangaben ergänzen. Die Platzhalter im Bereich „Rechtliches“ sind ausdrücklich noch keine fertigen Rechtstexte.
3. Stripe-/PayPal-Konten einrichten und Webhooks serverseitig verifizieren.
4. Banküberweisungsprozess und Abgleich definieren.
5. Adminbereich mit serverseitiger Autorisierung und Audit-Log ergänzen.
6. Sicherheits- und Zahlungstests durchführen.
\n\n## Neueste Admin-Erweiterung\n\nNach dem Admin-Migrationsskript muss zusätzlich `supabase/campaign_settings.sql` im SQL Editor ausgeführt werden. Erst danach kann der Adminbereich das Ziel und die Startseitentexte dauerhaft speichern. Der CSV-Export umfasst die letzten 1.000 geladenen Datensätze.\n