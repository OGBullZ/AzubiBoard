# Frischfach (Arbeitstitel)

App-Idee: Kassenbon oder eBon-Screenshot fotografieren → die App legt einen **digitalen Vorrat** an, erinnert vor dem Ablauf, schlägt Rezepte mit dem vor, was da ist, und führt eine Einkaufsliste, die weiß, was du schon hast.

> **Kein Teil von AzubiBoard.** Der Ordner liegt nur hier, weil der Arbeits-Branch vorgegeben war. Empfehlung: in ein eigenes Repo `frischfach` umziehen.

| Datei | Inhalt |
|---|---|
| [`KONZEPT.md`](./KONZEPT.md) | Vollständiges Konzept: Problem, Wettbewerb, Funktionen, Haltbarkeits-Logik, Bon-Erkennung, Architektur, Datenschutz, Roadmap, Risiken, Quellen |
| [`datenmodell.sql`](./datenmodell.sql) | MariaDB-Schema (Entwurf). In MariaDB 10.11 geladen und mit Beispieldaten geprüft (Constraints, Digest-Abfrage, Doppel-Import) |
| [`bon-extraktion.schema.json`](./bon-extraktion.schema.json) | JSON-Schema für die KI-Ausgabe der Bon-Erkennung (ohne Felder für Zahlungsdaten) |

**Visuelle Konzepte:** 8 klickbare Screens (Scan, Prüfen, Heute, Vorrat, Detail, Rezepte, Einkauf, Bilanz) auf einem Design-Canvas. Der Link steht in der PR-Beschreibung (privat, bei Bedarf über „Teilen“ freigeben).

**Nächster sinnvoller Schritt:** Phase 0 aus `KONZEPT.md` Kap. 13: 30 echte Bons sammeln und die Erkennung messen, bevor Code entsteht.
