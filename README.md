# Timebox Timer für Notion

Ein cleaner, minimalistischer Echtzeit-Timer mit einem ablaufenden orangenen Kreisring – optimiert für Timeboxing in Notion via GitHub Pages.

## Features

- **Echte Zeitmessung (`Date.now()`)**: Driftet nicht, auch wenn der Browser-Tab oder die Notion-Seite im Hintergrund ist.
- **Nur Minutenanzeige**: Zeigt die verbleibenden Minuten in der Mitte des Kreises ohne Sekunden.
- **Ungefüllter orangener Kreisring**: Repräsentiert die verbleibende Zeit und läuft im Uhrzeigersinn ab.
- **Cleanes Setup**: `-` und `+` links und rechts neben den Minuten (mit Halten zum schnellen Verstellen) verschwinden nach Klick auf **Start**.
- **Schwarzes Design mit Orange**: Schlichter schwarzer Hintergrund (`#000000`) mit orangenem Kreisring (`#ff7a1a`) – optional per URL anpassbar.

## Auf GitHub Pages veröffentlichen & in Notion einfügen

1. **Neues GitHub-Repository anlegen** (z. B. `notion-timebox-timer`, Public).
2. **Code hochladen / pushen** (eine der beiden Optionen):
   - **Option A – Direkt im Browser auf GitHub:** Im neuen Repository auf **uploading an existing file** (bzw. **Add file → Upload files**) klicken und `index.html`, `style.css`, `app.js` sowie `README.md` hochladen und committen.
   - **Option B – Per Git-Terminal:**
     ```bash
     cd notion-timer
     git config user.name "Dein Name"
     git config user.email "deine@email.de"
     git commit -m "Initial Notion timebox timer"
     git remote add origin https://github.com/<DEIN-USERNAME>/notion-timebox-timer.git
     git push -u origin main
     ```
3. **GitHub Pages aktivieren**:
   - Im GitHub-Repository auf **Settings → Pages** gehen.
   - Unter **Build and deployment** → Source: **Deploy from a branch**, Branch: **`main`**, Folder: **`/ (root)`** wählen und speichern.
   - Nach ~1 Minute ist der Timer unter `https://<DEIN-USERNAME>.github.io/notion-timebox-timer/` erreichbar.
4. **In Notion einfügen**:
   - In Notion `/embed` tippen (**Einbetten** auswählen).
   - Die GitHub-Pages-URL einfügen und Größe nach Wunsch anpassen.

## Optionale URL-Parameter für Notion

Du kannst mehrere Timer mit verschiedenen Voreinstellungen einbetten:

- `?m=45` oder `?minutes=45` — Startdauer in Minuten festlegen (1–180, Standard: `25`)
- `?theme=light` — Optionales helles Design (Standard: Schwarz `#000000`)
- `?bg=transparent` — Transparenter Hintergrund
- `?sound=off` — Dezenten End-Ton deaktivieren

Beispiel:
`https://<DEIN-USERNAME>.github.io/notion-timebox-timer/?m=45`
