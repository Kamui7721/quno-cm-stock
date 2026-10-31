# QUNO x CM

Baue eine vollständige Web-App namens "QUNO x CM" — ein Inventur-Management-Tool für ein Restaurant. Die App soll exakt wie Quno aussehen: dunkles Apple-Style Design, Hintergrund #0f1117, Akzentfarbe #e11d48 (Rot), saubere Karten mit abgerundeten Ecken, dezente Borders (#1e2130), weiße Schrift, Sidebar-Navigation links. Alle Texte in Deutsch, Währung Euro.

---

PASSWORTSCHUTZ:
Vor dem Zugang zur App steht eine Login-Seite mit festem Passwort (vorerst: "clubmichel2026"). Kein User-System, kein Supabase Auth — nur ein simpler Passwort-Check im Frontend mit sessionStorage.

---

NAVIGATION (Sidebar links):
1. Dashboard
2. Produkte
3. Lieferanten
4. Rechnungen
5. Zählung
6. Verkaufszahlen
7. Einstellungen

---

SUPABASE TABELLEN — erstelle folgendes Schema:

kategorien: id (uuid, pk), name (text), typ (text: 'getränk' | 'lebensmittel'), farbe (text)

lieferanten: id (uuid, pk), name (text), kontaktperson (text), telefon (text), email (text), adresse (text), kundennummer (text), iban (text), erstellt_am (timestamp, default now())

produkte: id (uuid, pk), name (text), kategorie_id (uuid, fk → kategorien), lieferant_id (uuid, fk → lieferanten), einheit (text: 'kg' | 'l' | 'stück'), aktueller_bestand (numeric, default 0), erstellt_am (timestamp, default now())

rechnungen: id (uuid, pk), rechnungsnummer (text), lieferant_id (uuid, fk → lieferanten), datum (date), gesamtbetrag (numeric), bezahlt (boolean, default false), pdf_url (text), gmail_message_id (text, unique), erstellt_am (timestamp, default now())

rechnungspositionen: id (uuid, pk), rechnung_id (uuid, fk → rechnungen), produkt_id (uuid, nullable, fk → produkte), kategorie_id (uuid, fk → kategorien), bezeichnung (text), menge (numeric), preis (numeric)

zaehlungen: id (uuid, pk), kategorie_id (uuid, fk → kategorien), datum (date), monat (text, format: 'YYYY-MM'), status (text: 'offen' | 'abgeschlossen'), abgeschlossen_am (timestamp, nullable), notiz (text, nullable)

zaehlungspositionen: id (uuid, pk), zaehlung_id (uuid, fk → zaehlungen), produkt_id (uuid, fk → produkte), ist_bestand (numeric), soll_bestand (numeric), differenz (numeric), differenz_prozent (numeric)

verkaufszahlen: id (uuid, pk), produkt_id (uuid, fk → produkte), monat (text, format: 'YYYY-MM'), verkaufte_menge (numeric), umsatz (numeric), erstellt_am (timestamp, default now())

---

MODUL 1 — DASHBOARD:
- 4 KPI-Karten oben: "Offene Rechnungen" (Anzahl + Summe €), "Produkte im Inventar" (Anzahl), "Letzte Zählung" (Datum + Kategorie), "Unbezahlte Rechnungen" (Summe €)
- Darunter: Tabelle der letzten 5 Rechnungen mit Status-Badge (bezahlt = grün, offen = rot)
- Darunter: Übersicht der letzten Zählungen pro Kategorie mit Differenz %

---

MODUL 2 — PRODUKTE:
- Liste aller Produkte als Tabelle: Name, Kategorie (farbiger Badge), Lieferant, Einheit, aktueller Bestand
- Filter nach Kategorie oben
- Button "+ Produkt hinzufügen" oben rechts → Modal mit: Name, Kategorie (Dropdown), Lieferant (Dropdown), Einheit, aktueller Bestand
- Klick auf ein Produkt → Detail-Drawer von rechts mit allen Feldern inkl. Lieferanten-Infos (Kontaktperson, Telefon, Email, Adresse, Kundennummer, IBAN)
- In diesem Drawer auch: Verlauf der letzten Zählungen für dieses Produkt (IST vs SOLL, Differenz)

---

MODUL 3 — LIEFERANTEN:
- Liste aller Lieferanten: Name, Kontaktperson, Telefon, Email
- Button "+ Lieferant hinzufügen" → Modal mit allen Feldern (Name, Kontaktperson, Telefon, Email, Adresse, Kundennummer, IBAN)
- Klick auf Lieferant → Detail-Drawer mit allen Infos + Liste der verknüpften Produkte

---

MODUL 4 — RECHNUNGEN:
- Tabelle: Rechnungsnummer, Lieferant, Datum, Betrag, Status (bezahlt/offen als Toggle-Badge — klickbar um Status zu ändern), PDF-Icon
- Filter: nach Lieferant, nach Monat, nach Status
- Button "+ Rechnung manuell hinzufügen" → Modal mit: Rechnungsnummer, Lieferant (Dropdown), Datum, Positionen (dynamisch hinzufügbar: Bezeichnung, Kategorie, Produkt optional, Menge, Preis), Gesamtbetrag (auto-berechnet)
- Klick auf Rechnung → Detail-Drawer mit allen Positionen, PDF-Vorschau falls vorhanden, Bezahlt-Toggle

---

MODUL 5 — ZÄHLUNG:
- Übersichtsseite: Karten pro Kategorie — zeigt letzte Zählung (Datum) + Status-Badge
- Button "+ Neue Zählung" pro Kategorie-Karte
- Klick auf Kategorie → Zählungsseite: Liste aller Produkte dieser Kategorie mit Eingabefeld "Gezählt" pro Produkt. Aktueller Soll-Bestand wird daneben angezeigt (ausgegraut).
- Unten: Button "Zählung abschließen" → berechnet Differenz und differenz_prozent, setzt Status auf 'abgeschlossen', speichert in zaehlungspositionen
- Zählungs-Historie: gruppiert nach Monat, pro Eintrag: Kategorie, Datum, Status, Ø Differenz %

---

MODUL 6 — VERKAUFSZAHLEN:
- Zwei Reiter: "Übersicht" und "Eintragen"
- Übersicht: Tabelle nach Monat filterbar — Produkt, Monat, verkaufte Menge, Umsatz
- Eintragen: Formular — Produkt (Dropdown), Monat (Monats-Picker), verkaufte Menge, Umsatz → Speichern-Button

---

MODUL 7 — EINSTELLUNGEN:
- Kategorien verwalten: Liste mit Farbpunkt + Name + Typ. Button "+ Kategorie hinzufügen" → Modal: Name, Typ (Getränk/Lebensmittel), Farbe (Colorpicker). Kategorien können bearbeitet und gelöscht werden.
- Passwort ändern: Eingabefeld für neues Passwort, Speichern (updated sessionStorage-Wert und zeigt Hinweis dass es im Code geändert werden muss)
- Gmail-Verbindung: Info-Sektion "inventur.clubmichel@gmail.com" mit Status-Badge (wird später für n8n-Automation genutzt)

---

DESIGN-DETAILS:
- Sidebar: #0d0f18 Hintergrund, aktiver Menüpunkt mit #e11d48 linker Border + leicht roter Hintergrund
- Karten: #1e2130 Hintergrund, 1px Border #2a2d3e, border-radius 12px
- Buttons primär: #e11d48, hover: #be123c
- Badges: grün (#10b981 bg mit 20% opacity + #10b981 Text), rot (#e11d48 bg mit 20% opacity + #e11d48 Text), gelb für "offen"
- Tabellen: Zeilen alternierend leicht unterschiedlich, hover-Highlight
- Modals: dunkler Overlay, zentriert, gleicher Kartenstil
- Drawer: von rechts, 480px breit, scrollbar
- Font: System-UI / Inter
- Logo oben links in Sidebar: "QUNO x CM" in Weiß, klein darunter "Inventur" in #e11d48

---

WICHTIG:
- Keine Dummy-Daten außer 3 Beispiel-Kategorien: "Getränke" (blau), "Lebensmittel" (grün), "Spirituosen" (lila)
- Alle Supabase-Queries mit korrektem Error-Handling
- Responsive ist nicht priorität — Desktop-first
- Kein Supabase Auth, kein RLS vorerst

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://quno-cm-stock.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e7461454-ab18-43b4-9bb2-3963cb60370c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
