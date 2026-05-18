# AzubiBoard — Lokale Installation (Windows-Server, XAMPP)

> Diese Anleitung richtet sich an einen **Windows-Server ohne vorinstallierte Software**.
> Am Ende läuft AzubiBoard unter `http://<server-ip>/azubiboard/` im lokalen Netzwerk.

---

## Übersicht (was wir installieren)

| Software | Wozu | Download |
|---|---|---|
| **XAMPP** | Apache (Webserver) + PHP + MariaDB (Datenbank) | apachefriends.org |
| **Node.js** | Nur für den Build-Schritt auf deinem **Laptop** — nicht auf dem Server nötig |

---

## Teil 1 — Auf dem Server: XAMPP installieren

### 1.1 XAMPP herunterladen und installieren

1. Auf dem Server Browser öffnen → **apachefriends.org** → **XAMPP for Windows** → Version mit **PHP 8.2** herunterladen (Dateiname: `xampp-windows-x64-8.2.x-x-VS16-installer.exe`, ca. 160 MB).

2. Installer starten → alles auf **Standard** lassen:
   - Install-Pfad: `C:\xampp`
   - Komponenten: mindestens **Apache** + **MySQL** + **PHP** anhaken

3. Nach der Installation: **XAMPP Control Panel** startet automatisch.

### 1.2 Apache und MySQL starten

Im XAMPP Control Panel:
- Neben **Apache** auf **Start** klicken → Status wird grün
- Neben **MySQL** auf **Start** klicken → Status wird grün

**Test:** Browser öffnen → `http://localhost` → du siehst die XAMPP-Startseite ✓

### 1.3 PHP-Konfiguration anpassen

Für Datei-Uploads (PDF) muss die Upload-Grenze erhöht werden:

1. XAMPP Control Panel → neben **Apache** auf **Config** → **php.ini** öffnen
2. Diese zwei Zeilen suchen (Strg+F) und anpassen:
   ```
   upload_max_filesize = 15M
   post_max_size = 16M
   ```
3. Datei speichern → Apache im Control Panel **Stop** dann **Start**

---

## Teil 2 — Auf deinem Laptop: Frontend bauen

> Dieser Schritt läuft auf deinem **Entwicklungs-Laptop** (wo der Code liegt), nicht auf dem Server.

### 2.1 `.env` für den Server erstellen

Im Projektordner `AzubiBoard/` eine Datei `.env` anlegen (oder die bestehende bearbeiten).  
Inhalt — **IP-Adresse des Servers eintragen** (z.B. `192.168.1.50`):

```env
VITE_BASE_PATH=/azubiboard/
VITE_USE_API=true

DB_HOST=localhost
DB_PORT=3306
DB_NAME=azubiboard
DB_USER=azubiboard_user
DB_PASS=HIER_SICHERES_PASSWORT_WAEHLEN

JWT_SECRET=HIER_MINDESTENS_32_ZUFAELLIGE_ZEICHEN
JWT_EXPIRY=604800

ALLOWED_ORIGIN=http://HIER_SERVER_IP

APP_ENV=production
```

**JWT_SECRET generieren** (im PowerShell auf dem Laptop):
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```
→ Ausgabe kopieren und als `JWT_SECRET` eintragen.

**Wichtig:** `ALLOWED_ORIGIN` muss exakt die URL sein, unter der die App später erreichbar ist, z.B. `http://192.168.1.50`.

### 2.2 Frontend bauen

Im Terminal (PowerShell) im Projektordner:

```powershell
cd C:\Users\Master\Desktop\Code\AzubiBoard
npm run build
```

→ Erstellt den Ordner `dist/` mit allen fertigen Dateien (~3 MB).

### 2.3 Dateien zusammenstellen (Kopier-Paket)

Folgende Ordner/Dateien musst du auf den Server kopieren:

```
AzubiBoard/
├── dist/              ← Fertiges Frontend (aus dem Build)
├── api/               ← PHP-Backend
├── database/          ← SQL-Schema
├── uploads/           ← Leer, wird für Avatare gebraucht
└── .env               ← Konfiguration (mit echten Werten!)
```

Kopiere diese per **USB-Stick**, **freigegebenen Netzwerkordner** oder wie bei euch üblich auf den Server.

---

## Teil 3 — Auf dem Server: Dateien einrichten

### 3.1 Ordner anlegen

Im Explorer auf dem Server: `C:\xampp\htdocs\` öffnen.  
Neuen Ordner erstellen: **`azubiboard`**

### 3.2 Dateien kopieren

Aus dem Kopier-Paket folgendes in `C:\xampp\htdocs\azubiboard\` kopieren:

```
C:\xampp\htdocs\azubiboard\
├── (alle Dateien aus dist/)   ← index.html, assets/, sw.js, etc.
├── api/
├── uploads/
└── .env
```

> **Wichtig:** Die Inhalte von `dist/` direkt (nicht den Ordner `dist/` selbst) in `azubiboard/` kopieren — also `index.html` soll direkt unter `azubiboard/index.html` liegen.

### 3.3 `.htaccess` prüfen

In `C:\xampp\htdocs\azubiboard\` muss eine Datei `.htaccess` liegen (kommt aus `dist/`).  
Falls sie fehlt, gibt es Routing-Probleme. Explorer zeigt sie evtl. nicht an — kurz prüfen:
- PowerShell: `ls C:\xampp\htdocs\azubiboard\.htaccess`

### 3.4 `uploads/`-Ordner beschreibbar machen

1. Rechtsklick auf `C:\xampp\htdocs\azubiboard\uploads\`
2. **Eigenschaften** → **Sicherheit** → **Bearbeiten**
3. Für den Benutzer **IUSR** (oder **Alle**): **Schreiben** erlauben → OK

---

## Teil 4 — Datenbank einrichten

### 4.1 phpMyAdmin öffnen

Browser auf dem Server → `http://localhost/phpmyadmin`  
Login: **Benutzername:** `root` | **Passwort:** (leer lassen bei Standard-XAMPP)

### 4.2 Datenbank erstellen

1. Links oben: **Neu** klicken
2. Datenbankname: `azubiboard`
3. Zeichensatz: `utf8mb4_unicode_ci`
4. **Erstellen** klicken

### 4.3 Datenbankbenutzer anlegen

1. Oben: **Benutzerkonten** → **Benutzerkonto hinzufügen**
2. Benutzername: `azubiboard_user`
3. Hostname: `localhost`
4. Passwort: das gleiche wie `DB_PASS` in deiner `.env`
5. Checkbox: **Erstelle eine Datenbank mit gleichem Namen und gewähre alle Rechte** — **NICHT** anhaken
6. Unten: **Hinzufügen** klicken

Dann dem User Rechte geben:
1. Beim neuen User auf **Rechte bearbeiten** klicken
2. Unter **Datenbankspezifische Rechte**: Datenbank `azubiboard` wählen
3. Rechte: **SELECT, INSERT, UPDATE, DELETE, CREATE** anhaken
4. **OK**

### 4.4 Schema importieren

1. Links: Datenbank **azubiboard** anklicken
2. Oben: **Importieren**
3. **Datei auswählen** → `database/setup.sql` aus dem Kopier-Paket
4. Unten **Importieren** klicken → ✓ fertig

---

## Teil 5 — Apache konfigurieren (mod_rewrite aktivieren)

### 5.1 mod_rewrite einschalten

XAMPP Control Panel → Apache **Config** → **httpd.conf** öffnen.

Suchen (Strg+F): `#LoadModule rewrite_module`  
Das `#` am Anfang entfernen → Zeile sieht danach so aus:
```
LoadModule rewrite_module modules/mod_rewrite.so
```

### 5.2 AllowOverride aktivieren

In derselben Datei nach `<Directory "C:/xampp/htdocs">` suchen.  
Den Block so anpassen dass `AllowOverride All` steht:
```apache
<Directory "C:/xampp/htdocs">
    Options Indexes FollowSymLinks Includes ExecCGI
    AllowOverride All
    Require all granted
</Directory>
```

### 5.3 mod_headers einschalten (für Security-Headers)

Ebenfalls in `httpd.conf` suchen: `#LoadModule headers_module`  
Das `#` entfernen:
```
LoadModule headers_module modules/mod_headers.so
```

### 5.4 Apache neu starten

XAMPP Control Panel → Apache **Stop** → **Start**

---

## Teil 6 — Ersten Account anlegen + Ausbilder-Rolle setzen

### 6.1 App aufrufen

Browser auf dem Server: `http://localhost/azubiboard/`  
→ Du siehst den Login-Screen ✓

### 6.2 Ersten Account registrieren

1. Auf **Registrieren** klicken
2. Name, E-Mail, Passwort (min. 8 Zeichen) eingeben
3. **Registrieren** → du bist als Azubi eingeloggt

### 6.3 Rolle auf Ausbilder setzen

Da der erste Account automatisch "Azubi" ist, muss die Rolle per SQL geändert werden:

1. phpMyAdmin → `http://localhost/phpmyadmin`
2. Datenbank **azubiboard** → Tabelle **users**
3. Oben: **SQL**-Tab
4. Eingeben:
   ```sql
   UPDATE users SET role='ausbilder' WHERE email='DEINE_EMAIL@ADRESSE';
   ```
5. **Ausführen** → ✓

Seite neu laden → du siehst jetzt das Ausbilder-Dashboard.

---

## Teil 7 — Im Netzwerk erreichbar machen

### 7.1 Windows-Firewall öffnen

Damit andere PCs im Netzwerk die App aufrufen können:

1. **Windows-Firewall** öffnen (Suche: "Windows Defender Firewall")
2. Links: **Erweiterte Einstellungen**
3. **Eingehende Regeln** → rechts: **Neue Regel**
4. **Port** → **TCP** → Port **80** → **Verbindung zulassen** → Name: `XAMPP Apache`
5. **Fertig stellen**

### 7.2 IP-Adresse des Servers herausfinden

PowerShell auf dem Server:
```powershell
ipconfig | findstr "IPv4"
```
→ Notiere die Adresse, z.B. `192.168.1.50`

### 7.3 Auf anderen PCs aufrufen

Browser auf einem anderen PC im Netzwerk:
```
http://192.168.1.50/azubiboard/
```

---

## Teil 8 — Automatisch starten (optional)

Damit XAMPP bei Windows-Start automatisch läuft:

XAMPP Control Panel → rechts oben: **Config** → Häkchen bei **Autostart** für Apache und MySQL setzen.

Oder als Windows-Dienst installieren (robuster):  
XAMPP Control Panel → neben Apache: **Win-Service** → **Installieren** → gleiches für MySQL.

---

## Schnell-Test nach der Installation

| Test | Was prüfen |
|---|---|
| `http://localhost/azubiboard/` | Login-Screen sichtbar? |
| Registrieren + Einloggen | Kein Fehler? |
| Daten speichern (z.B. Projekt anlegen) | Wird gespeichert und nach Reload noch da? |
| `http://192.168.1.50/azubiboard/` von anderem PC | Erreichbar? |

---

## Häufige Probleme

| Symptom | Ursache | Fix |
|---|---|---|
| **404 bei allen Seiten** | `.htaccess` fehlt oder `AllowOverride` falsch | Teil 5 nochmal prüfen |
| **500 Serverfehler** | PHP-Fehler oder `.env` falsch | `C:\xampp\php\logs\php_error_log` öffnen |
| **"Datenbankfehler"** beim Login | DB-Credentials in `.env` falsch | `DB_PASS` + `DB_USER` prüfen |
| **"JWT_SECRET nicht gesetzt"** | `.env` fehlt oder liegt falsch | `.env` muss direkt in `azubiboard/` liegen, nicht in `dist/` |
| **Andere PCs können nicht zugreifen** | Firewall blockiert Port 80 | Teil 7.1 nochmal durchführen |
| **Uploads funktionieren nicht** | `uploads/`-Ordner nicht beschreibbar | Teil 3.4 nochmal durchführen |
| **App zeigt alten Stand** | Browser-Cache | Strg+Shift+R (Hard-Reload) |
