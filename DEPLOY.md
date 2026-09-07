# Putting ClouterX on your own server

The game is static files. There is no build step, no Node, no database — just
HTML, CSS and ES modules. Any web host that serves files will run it.

## What to upload

Everything except `docs/`, `tools/` and the markdown files:

```
index.html
src/          (20 .js files, including src/data/)
styles/main.css
```

That is **424 KB** in total. Keep the folder structure exactly as it is —
`index.html` loads `src/main.js`, which imports the rest by relative path.

## Simply.com, step by step

1. Log in and open your control panel for the **clouterx** domain.
2. Open **Filhåndtering** (File Manager), or use SFTP if you prefer — Simply
   gives you the host, username and port under **SFTP/FTP**.
3. Go into the web root. On Simply that is usually `public_html/`, and for an
   addon domain it is `public_html/clouterx.dk/` or similar — it is the folder
   whose contents appear when you visit the domain.
4. Upload `index.html`, the `src/` folder and the `styles/` folder into it.
   If you upload a zip, extract it there and make sure the files sit at the
   top level, not inside a `rack-and-ruin/` subfolder.
5. Visit your domain. It should load straight away.

### With SFTP from a terminal

```
git clone https://github.com/emilbundsgaard-crypto/rack-and-ruin.git
cd rack-and-ruin
sftp <user>@<host>
  cd public_html
  put index.html
  put -r src
  put -r styles
  bye
```

## Two things that can go wrong

**A blank page, and the console says something about modules or MIME types.**
The server is sending `.js` as `text/plain`. Browsers refuse to run modules
that are not `text/javascript`. Put a `.htaccess` next to `index.html`:

```apache
AddType text/javascript .js
```

**It works at the domain root but not in a subfolder.** It should — every path
in the game is relative. If you see 404s for `src/main.js`, the folder
structure was flattened during upload; re-upload keeping `src/` intact.

## Optional: caching

The game is small enough not to need it, but if you want repeat visits to be
instant, add this to `.htaccess`. Keep `index.html` uncached so an update is
picked up immediately:

```apache
<FilesMatch "\.(js|css)$">
  Header set Cache-Control "max-age=86400"
</FilesMatch>
<FilesMatch "index\.html$">
  Header set Cache-Control "no-cache"
</FilesMatch>
```

## Updating later

Re-upload the changed files. Saves live in the player's own browser
(`localStorage`), so an update never touches anybody's progress — the save
format is versioned and migrates itself.

## HTTPS

Simply issues a free Let's Encrypt certificate under **SSL** in the control
panel. Turn it on: the game does not need it to work, but browsers are
increasingly unfriendly to plain HTTP, and the sound needs a secure context on
some of them.
