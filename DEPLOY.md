# Putting ClouterX on your Simply.com server — from a MacBook

The game is static files: HTML, CSS and ES modules. No build step, no Node, no
database. 20 files, 396 KB.

Everything below uses Terminal, which is already on your Mac. Open it with
**⌘ + Space**, type `terminal`, press Return.

---

## 1. Find your SFTP details

Log in at [simply.com](https://www.simply.com) → your domain → **SFTP/FTP**.
Note down:

- **Host** — something like `ssh.simply.com`
- **Username** — usually your customer number, e.g. `s123456`
- **Password**

Also note the **web root**: the folder whose contents appear when you visit
your domain. On Simply that is normally `public_html`. If ClouterX is an addon
domain it may be `public_html/clouterx.dk`.

---

## 2. Back up what is on there now

You are about to delete it, and that cannot be undone. This copies the whole
web root to your Desktop first:

```bash
cd ~/Desktop
mkdir clouterx-backup
cd clouterx-backup
sftp USERNAME@ssh.simply.com
```

It will ask for your password. Then, at the `sftp>` prompt:

```
get -r public_html
bye
```

You now have `~/Desktop/clouterx-backup/public_html` with the old site in it.
Check it is there before going on.

---

## 3. Empty the web root

Do this in the browser, not Terminal — SFTP has no "delete a folder and
everything in it", and in the File Manager you can see exactly what is going.

1. Simply control panel → your domain → **Filhåndtering** (File Manager)
2. Open `public_html`
3. Select everything inside it — ⌘A, or the "select all" checkbox
4. Delete

Leave the `public_html` folder itself. You want it empty, not gone.

---

## 4. Get the game onto your Mac

```bash
cd ~/Desktop
git clone https://github.com/emilbundsgaard-crypto/rack-and-ruin.git clouterx
cd clouterx
```

If Terminal says `git: command not found`, macOS will offer to install the
developer tools — accept, wait, and run the clone again.

---

## 5. Upload

One command. Replace `USERNAME` with yours:

```bash
./tools/deploy.sh USERNAME@ssh.simply.com public_html
```

It asks for your password once, then uploads the 20 files the site needs into
the right folders. It never deletes anything — that was step 3.

If your web root is an addon-domain folder, say so:

```bash
./tools/deploy.sh USERNAME@ssh.simply.com public_html/clouterx.dk
```

---

## 6. Open your domain

It should load straight away.

---

## If something is wrong

**Blank page.** Almost always the server is sending `.js` as `text/plain`, and
browsers refuse to run modules that are not `text/javascript`. The upload
script already puts a `.htaccess` next to `index.html` that fixes this. If the
page is still blank, open the browser console (⌥⌘I in Safari or Chrome) — the
error will name the file it refused.

**404s for `src/main.js`.** The folder structure was flattened. Re-run step 5;
the script recreates `src/`, `src/data/` and `styles/` for you.

**`Permission denied` when uploading.** Wrong username or password, or the web
root path is wrong. Log in with plain `sftp USERNAME@ssh.simply.com` and run
`ls` to see what is actually there.

**The old site still shows.** Your browser cached it. Hard-reload with
**⇧⌘R**, or open the site in a private window.

---

## Turning on HTTPS

Simply control panel → your domain → **SSL** → enable the free Let's Encrypt
certificate. The game works without it, but browsers are increasingly
unfriendly to plain HTTP, and sound needs a secure context in some of them.

---

## Updating later

```bash
cd ~/Desktop/clouterx
git pull
./tools/deploy.sh USERNAME@ssh.simply.com public_html
```

No need to empty anything — it overwrites in place. Saves live in each
player's own browser (`localStorage`), so an update never touches anybody's
progress; the save format is versioned and migrates itself.

---

## Doing it without Terminal

If you would rather not use Terminal at all: download the repository as a ZIP
from GitHub (green **Code** button → **Download ZIP**), unzip it, and in the
File Manager upload `index.html`, the `src` folder and the `styles` folder
into `public_html`. Delete nothing else from the ZIP — `docs/` and `tools/` are
just not needed. You will also want to create a file called `.htaccess` in
`public_html` containing one line:

```apache
AddType text/javascript .js
```
