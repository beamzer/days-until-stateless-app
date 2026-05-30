# Dagen tot...

Statische webapp die laat zien hoeveel dagen tot je gebeurtenissen. Alle data zit in de URL-querystring (`?d=…`) — geen backend, geen login.

> **Waarom querystring en niet `#`?** iOS Safari knipt het hash-fragment weg bij "Zet op beginscherm" en in fullscreen-PWA-mode. Querystring blijft wél behouden. De keerzijde: `?d=<base64>` komt in je webserver-access-logs terecht (bij hash niet).

## Lokaal proberen

```sh
cd days_until
python3 -m http.server 8000
```

Open <http://localhost:8000>. Klik op `+` om een gebeurtenis toe te voegen. Sleep aan het ≡-handvat om te herrangschikken. Houd een blokje lang ingedrukt om te bewerken of wissen.

## Deploy op Linux webserver

1. **Upload** de hele map (`index.html`, `app.js`, `style.css`, `manifest.json`, `sw.js`, `icons/`) naar de webroot van een virtual host die met **HTTPS** wordt geserveerd. Service workers werken alleen op HTTPS (of localhost).

2. **MIME types** — zorg dat je webserver deze correct serveert:
   - `manifest.json` → `application/manifest+json`
   - `sw.js` → `application/javascript`

   ### nginx voorbeeld

   ```nginx
   types {
       application/manifest+json    webmanifest manifest.json;
       application/javascript        js;
   }

   location = /sw.js {
       add_header Cache-Control "no-cache";
   }
   location ~* \.(png|css)$ {
       add_header Cache-Control "public, max-age=2592000";
   }
   ```

   ### Apache voorbeeld (`.htaccess`)

   ```apache
   AddType application/manifest+json .json
   <Files "sw.js">
     Header set Cache-Control "no-cache"
   </Files>
   ```

3. **Op je iPhone**:
   - Open Safari op de URL.
   - Tik op de delen-knop → **Zet op beginscherm**.
   - Open de app vanaf het beginscherm — start fullscreen, zonder Safari-balkjes.

4. **Bij wijzigingen**: omdat de URL verandert moet je het icoon opnieuw op het beginscherm zetten. Verwijder het oude icoon, open de nieuwe URL in Safari, en voeg opnieuw toe. Dit is bewust zo: stateless, geen server-state.

## Update / nieuwe versie deployen

De service worker cachet alle assets. Bij elke wijziging aan `app.js`/`style.css`/`index.html`:

1. Verhoog `VERSION` in `sw.js` (bijv. `v1` → `v2`).
2. Upload alle gewijzigde bestanden.
3. De nieuwe SW activeert bij volgende bezoek en verwijdert oude cache.

## Bestanden

| Bestand | Doel |
|---|---|
| `index.html` | Markup + iOS PWA meta-tags |
| `app.js` | Alle logica (URL-codering, render, modal, drag) |
| `style.css` | Mobile-first responsive styling |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (cache-first) |
| `icons/` | App icons (192/512/180) |
