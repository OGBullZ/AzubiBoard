# M5a — IHK-Recherche-Spike: Berichtsheft digital

> Stand: 13. Juni 2026 · zeitboxierter Spike (web-recherchiert).
> Frage: Bietet die IHK fürs Berichtsheft eine **offene API / ein Importformat** (→ Anbindung),
> oder bleibt nur **Export** (→ AzubiBoard erzeugt die Datei, der Azubi reicht sie ein)?

## TL;DR — Entscheidung: **Export, keine API**

Es gibt **keine öffentliche IHK-Schnittstelle**, in die ein Drittanbieter wie AzubiBoard den
Ausbildungsnachweis pushen könnte. Die Einreichung läuft als **eine signierte PDF**, hochgeladen
ins jeweilige **IHK-eigene Prüfungsportal** (Azubi-Infocenter) bei der Anmeldung zur
Abschlussprüfung — ein geschlossenes System ohne Dritt-API. → **M5 reduziert sich auf einen
exzellenten, vollständigen, IHK-konformen PDF-Export. M5c (Direkt-Einreichung per API) entfällt.**

## Befunde

### 1. Einreichung = signierte Gesamt-PDF ins IHK-Prüfungsportal
- Der Ausbildungsnachweis muss zur **Prüfungsanmeldung** als **vollständige PDF** hochgeladen
  werden (Azubi-Infocenter), bei manchen IHKs alternativ per Mail als **eine PDF, max. 25–35 MB**.
- **Von Azubi UND Ausbildungsbetrieb unterschrieben** — Zulassungsvoraussetzung nach
  **§ 43 Abs. 1 Nr. 2 BBiG**.
- Letzter Eintrag bei Anmeldung **≤ 14 Tage** alt; fehlende Nachweise vorher vom Ausbilder freigeben.
- Kein standardisiertes maschinenlesbares Format gefordert — es ist eine **PDF zum Hochladen/Mailen**.

### 2. Offizielles IHK-„Digitales Berichtsheft" wird abgeschaltet (31.12.2026)
- Die IHK DIGITAL GmbH stellt das „Digitale Berichtsheft" im *Serviceportal Bildung*
  **bundesweit zum 31.12.2026 ein**; **Neuanmeldungen seit Sept. 2025 gesperrt**.
- Azubis sollen ihre Daten **vorher als PDF exportieren** und auf **Drittanbieter** ausweichen.
  Die IHK spricht keine Empfehlung aus („Vielzahl der Angebote").
- **Folge / Chance:** Genau die Lücke, die AzubiBoard füllt. Tausende Azubis brauchen bis
  Ende 2026 eine Alternative — Timing ist günstig.

### 3. BLok (Online-Berichtsheft, BPS/TU Chemnitz) — separates System
- Von einigen IHKs kostenlos angeboten; Abgleich mit Ausbildungsrahmenplan, Mobil, Ausbilder-Sicht.
- **Keine öffentliche API/Import-Schnittstelle dokumentiert** — eigenes Portal, kein Andock-Ziel.

### 4. Wettbewerb (Drittanbieter, die die Lücke besetzen)
- z. B. Talent2Go, BerichtsheftKI u. a. — kommerzielle Ausbildungs-/Berichtsheft-Tools.
- Bestätigt das Modell: **Tool führt das Heft + erzeugt die einreichbare PDF.** Keiner integriert per API in die IHK.

## Konsequenz für AzubiBoards M5

**Kein Integrations-Target. Der Hebel ist der Export.** Was AzubiBoard dafür braucht:

| Anforderung (aus Recherche) | Status in AzubiBoard | To-Do |
|---|---|---|
| IHK-konforme Einzelwoche (Stammdaten, Unterschriften) | ✅ `printReportIHK` (d4a154a) + Tagesstruktur (b0cd2c3) | — |
| **Eine vollständige Gesamt-PDF** (alle Wochen, ein Dokument) | ⚠️ `printJahresmappe` = pro Jahr | **„Kompletter Ausbildungsnachweis"-Export** (alle KW chronologisch, ein PDF) |
| Unterschriften Azubi + Ausbilder (§43 BBiG) | ✅ Unterschriftenfelder im Druck | ggf. Hinweis „ausdrucken + unterschreiben" / später digitale Signatur |
| Dateigröße ≤ 25 MB, ein File | ✅ Druck-PDF klein | bei eingebetteten Scans/OCR im Blick behalten |
| Letzter Eintrag ≤ 14 Tage, Lücken sichtbar | ✅ Heft-Lücken/Quote (c63e8bd, be0b466) | — |

**Empfohlener nächster M5-Schritt:** „**Kompletter Ausbildungsnachweis als eine PDF**" — alle
Wochenberichte eines Azubis chronologisch in einem Dokument (Deckblatt mit Stammdaten +
fortlaufende Nachweis-Nrn + Unterschriftenseite), browser-druckbar wie die vorhandenen Varianten.
Das ist exakt die Datei, die der Azubi bei der Prüfungsanmeldung hochlädt.

**Nicht weiterverfolgen:** Direkte IHK-API-Anbindung (M5c) — existiert nicht.

## Quellen
- [IHK Hannover — Digitales Berichtsheft nur noch bis Ende 2026](https://www.ihk.de/hannover/hauptnavigation/ausbildung-und-weiterbildung/ausbildung/aktuell/digitales-berichtsheft-gibt-es-nur-noch-bis-ende-2026-6743960)
- [IHK Nordschwarzwald — Service „Digitales Berichtsheft" wird 2026 eingestellt](https://www.ihk.de/nordschwarzwald/aus-und-weiterbildung/ausbildung/ausbildung-digital/serviceportal-bildung-berichtsheft/service-digitales-berichtsheft-wird-eingestellt-6821804)
- [BLok — das Online-Berichtsheft (IHK Schwarzwald-Baar-Heuberg)](https://www.ihk.de/sbh/ausbildung/schueler-fachkraefte2/blok-4037958)
- [BLok / BPS Bildungsportal Sachsen](https://www.bps-system.de/blok-berichtsheft/)
- [IHK München — Berichtsheft als Ausbildungsnachweis](https://www.ihk-muenchen.de/de/berufsbildung-berufszugang/ausbilden/ausbildungsverhaeltnis/berichtsheft/klassisches-berichtsheft/)
- [IHK Niederbayern — Ausbildungsnachweis (PDF-Upload zur Prüfungsanmeldung)](https://www.ihk-niederbayern.de/berufliche-bildung/ausbildung/infos-fuer-azubis/ausbildungsnachweis/)
- [Talent2Go — IHK Berichtsheft-Abschaltung 2025/2026 & Alternativen](https://talent2go.de/blog/ihk-berichtsheft-abschaltung/)
