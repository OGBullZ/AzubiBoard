# AzubiBoard — Roadmap v2 (Post-v1.0 / Vision)

> Stand: 13. Juni 2026 · `main = a2614e3` · Schema v5
> v1.0-Restliste → `ZIELE-v1.md` · v1-Historie → `ROADMAP.md` / `HANDOVER.md`
> Dies ist die **vorausschauende** Roadmap für alles NACH v1.0.

**Lage:** Code-seitig ist v1.0 fertig und live (Firebase Hosting, CI-Auto-Deploy aktiv).
Die einzige offene v1.0-Arbeit ist die **Server-Tier-Live-Verifikation** (`ZIELE-v1.md` Tier 1).
Diese Roadmap beschreibt, was danach kommt.

---

## ⛓️ Voraussetzung (Gate)

**Fast alles in v2 setzt ein laufendes Backend voraus** — der heutige Live-Stand ist
Frontend-only/localStorage (Firebase Hosting). Bevor v2-Features echten Mehrwert haben,
muss das **Ubuntu-Tier-1-Deployment stehen** (`10.14.99.10`: MariaDB + PHP-API live,
Migration/RLS/Dual-Write/Schema-Reads verifiziert). → Erst `ZIELE-v1.md` Tier 1 abschließen.

Ausnahmen, die **ohne** Server gebaut werden können, sind unten mit **[hier]** markiert.

---

## 🔀 Strategische Weggabelung (eine Entscheidung ordnet die ganze Roadmap)

Bevor priorisiert wird, eine Grundsatzfrage:

| Richtung | Bedeutung | Folge für die Roadmap |
|---|---|---|
| **A — Eigen-Tool** | AzubiBoard bleibt das Werkzeug für **einen Betrieb** (deinen). Gruppen reichen zur Trennung. | **M5 (IHK) + AI + Analytics zuerst.** M4 entfällt. Klein, fokussiert, hoher Eigennutzen. |
| **B — SaaS** | AzubiBoard soll **mehrere Betriebe** bedienen (Mandanten, Self-Service-Onboarding). | **M4 (Multi-Tenant) wird Fundament** und kommt vor fast allem. Großer Architektur-Umbau. |

**✅ ENTSCHIEDEN (2026-06-13): Richtung A** — AzubiBoard soll real von mehreren Leuten
(Azubis + Ausbilder, geteilte Daten, server-seitige Prüfung) genutzt werden.
Damit wird das **Server-Tier (`ZIELE-v1` Tier 1) zur #1-Priorität** und Gate für fast alles
Weitere. M4 (Multi-Tenant) bleibt vorerst draußen (das wäre Richtung B/SaaS — mehrere
*Betriebe*; hier geht es um mehrere *Nutzer eines* Betriebs, das deckt die Gruppen-/RLS-Logik
bereits ab, sie muss nur live).

**⚠️ Offener Blocker für A:** Der Deploy-Ziel-Server `10.14.99.10` ist eine **LAN-IP**.
Für „mehrere Nutzer" muss geklärt werden, ob alle im selben Netz/VPN sind (dann reicht der
LAN-Server) oder ob **öffentliches Hosting** nötig ist (dann anderer Host + Domain/HTTPS).
Das ist die erste zu klärende Frage, bevor die Server-Sitzung startet.

---

## V2.1 — Realer Ausbildungsnutzen (höchster Wert)

Das, was AzubiBoard von „nettes Lernprojekt" zu „nutze ich täglich für die echte Ausbildung" hebt.

| ID | Item | Wert | Aufwand | Abhängigkeit | Offene Frage / Risiko |
|---|---|---|---|---|---|
| **M5a** | **IHK-Recherche-Spike** — was bieten die IHKs digital? (BLok, „Online-Berichtsheft", Kammer-Portale). Gibt es eine öffentliche API oder nur ein Importformat? | Klärt M5b/M5c | S | [hier] | Ergebnisoffen — viele IHKs haben **keine** offene API, nur eigene Portale. Spike entscheidet, ob „Anbindung" oder „Export" |
| **M5b** | **IHK-konformer Berichtsheft-Export** ausbauen (PDF/Format nach IHK-Vorgabe; baut auf vorhandenem IHK-PDF aus Sprint 6 auf) | Hoch | M | M5a | Format pro Kammer leicht unterschiedlich |
| **M5c** | **Direkt-Einreichung** (nur falls M5a eine API findet) | Sehr hoch | L | M5a, Server | Auth/OAuth gegen Kammer-System, evtl. gar nicht möglich |
| **AI3** | **KI-Prüfungsvorbereitung** — Quiz/Karteikarten aus einem Thema generieren (baut auf vorhandenem Quiz/SM-2 + Claude-API aus Sprint 14 auf) | Hoch | M | Claude-API-Key | Kosten/Rate-Limit; gut cachebar |
| **AI4** | **KI-Feedback auf Wochenberichte** — Vorschläge zu Vollständigkeit/Formulierung vor dem Einreichen | Mittel | M | Claude-API-Key | Darf Ausbilder-Prüfung nicht ersetzen (nur Hilfe) |
| **AN1** | **Ausbilder-Analytics** — Fortschritts-/Vollständigkeits-Dashboard: Berichtsheft-Lücken pro Azubi, Prüfungs-Readiness, Lernziel-Quote | Hoch | M | Daten live (Server) | — |

**Empfohlener Einstieg V2.1:** M5a-Spike **[hier, sofort machbar]** — er kostet wenig und
entscheidet, wie groß M5 überhaupt wird. Parallel AI3 (rein clientseitig + Claude-API baubar).

---

## V2.2 — Robustheit & Betrieb

Härtung statt neuer Features — relevant sobald die App real genutzt wird.

| ID | Item | Wert | Aufwand | Abhängigkeit | Notiz |
|---|---|---|---|---|---|
| **MOB1** | **Offline-first im API-Modus härten** | Mittel | M | Server | Retry-Queue + Conflict-Detection existieren schon (Sprint 4/5). Lücken schließen, Service-Worker-Caching-Strategie schärfen. **Mobile bleibt out-of-scope** (PC-only) |
| **N2** | **Deadline-Reminder** — Push/Mail wenn Berichtsheft fällig (baut auf N1-SMTP + Web-Push aus Sprint 6/8) | Mittel | S–M | Server (Mail/Push) | — |
| **SEC2** | **RBAC-Granularität** — Permissions per Feature statt 3 fixer Rollen | Mittel | L | — | Sinnvoll v.a. **als Vorbereitung für M4**. Bei Richtung A optional |
| **OPS-x** | **Backup-/Restore live verifizieren** (mysqldump-Cron + Restore-Modal real testen) | Mittel | S | Server | Doku existiert (`docs/Backup-Sanity-Check.md`), nie live durchgespielt |

---

## V2.3 — Skalierung (NUR bei Richtung B / SaaS)

Großer Architektur-Block. Nur anfassen, wenn AzubiBoard mehrere Betriebe bedienen soll.

| ID | Item | Aufwand | Notiz |
|---|---|---|---|
| **M4a** | **Tenant-Architektur** — `tenant_id` auf allen Tabellen, tenant-scoped Auth + RLS auf Tenant-Ebene | XL | Fundament; berührt jedes Backend-Modul |
| **M4b** | **Tenant-Admin + Self-Service-Onboarding** — Betrieb registriert sich selbst, legt Ausbilder an | L | Neuer Rollen-Layer über den 3 bestehenden |
| **M4c** | **Mandanten-Trennung im Frontend** — Branding/Subdomain, Daten-Isolation client- und serverseitig | L | — |
| **M4d** | (optional) **Billing/Abo** | L | Nur bei echtem Produkt-Vorhaben |

→ Wenn B gewählt wird, kommt **SEC2 (RBAC)** sinnvollerweise VOR M4 (granulare Permissions sind die halbe Multi-Tenant-Miete).

---

## 🚫 Bewusst NICHT geplant

- **Native Mobile-App / Touch-Optimierung** — App ist PC/Laptop-only (User-Entscheid). MOB1 = nur Offline-Robustheit am Desktop.
- **Echtzeit-Kollaboration (WebSockets/SSE)** — Smart-Polling (Sprint 4) reicht für den Use-Case; FastCGI verträgt keine persistenten Verbindungen.
- **Eigene Auth-Föderation (SSO/SAML)** — nur relevant im Enterprise-/SaaS-Kontext (Richtung B, dann separat bewerten).

---

## 🧭 Empfohlene Reihenfolge (Richtung A)

```
0. v1.0 abschließen        → Server-Tier live (ZIELE-v1.md Tier 1)   [BLOCKER]
1. M5a IHK-Spike           → entscheidet Größe von M5                 [hier, jetzt]
2. AI3 KI-Prüfungsprep     → clientseitig + Claude-API               [hier, parallel]
3. M5b IHK-Export          → echter Berichtsheft-Nutzen
4. AN1 Ausbilder-Analytics → Fortschritts-Dashboard
5. AI4 / N2 / MOB1         → Härtung nach echtem Praxiseinsatz
   (SEC2 + M4 nur falls Richtung B)
```

**Nächster konkreter Schritt ohne Server:** M5a-Spike (IHK-Digital-Landschaft recherchieren)
und/oder AI3 (KI-Prüfungsvorbereitung) — beide **[hier]** baubar, blockieren nicht auf dem Ubuntu-Server.
