#!/bin/bash
# Upload ClouterX to a plain web host over SFTP. Built for macOS, which ships
# with everything this needs — no Homebrew, no Node.
#
#   ./tools/deploy.sh user@ssh.simply.com public_html
#
# It stages only the files the site actually needs, then puts them in place.
# It does not delete anything on the server: clear the web root yourself first
# (see DEPLOY.md) so you can see what you are removing.

set -euo pipefail

REMOTE="${1:-}"
WEBROOT="${2:-public_html}"

if [ -z "$REMOTE" ]; then
  echo "usage: ./tools/deploy.sh <user@host> [webroot]" >&2
  echo "   eg: ./tools/deploy.sh emil@ssh.simply.com public_html" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
if [ ! -f index.html ]; then
  echo "Run this from the ClouterX folder — index.html is not here." >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Only what the browser asks for. No docs, no tools, no git.
mkdir -p "$STAGE/src/data" "$STAGE/styles"
cp index.html "$STAGE/"
cp src/*.js "$STAGE/src/"
cp src/data/*.js "$STAGE/src/data/"
cp styles/main.css "$STAGE/styles/"

# Ships the MIME-type fix and the no-cache rules. See tools/htaccess.txt.
cp tools/htaccess.txt "$STAGE/.htaccess"

COUNT=$(find "$STAGE" -type f | wc -l | tr -d ' ')
SIZE=$(du -sh "$STAGE" | cut -f1)
echo "Uploading $COUNT files ($SIZE) to $REMOTE:$WEBROOT"
echo

BATCH="$STAGE/.sftp-batch"
{
  echo "cd $WEBROOT"
  echo "-mkdir src"
  echo "-mkdir src/data"
  echo "-mkdir styles"
  echo "put $STAGE/index.html index.html"
  echo "put $STAGE/.htaccess .htaccess"
  for f in "$STAGE"/src/*.js;      do echo "put $f src/$(basename "$f")"; done
  for f in "$STAGE"/src/data/*.js; do echo "put $f src/data/$(basename "$f")"; done
  echo "put $STAGE/styles/main.css styles/main.css"
  echo "bye"
} > "$BATCH"

sftp -b "$BATCH" "$REMOTE"

echo
echo "Done. Open your domain — it should load straight away."
echo "If the page is blank, check DEPLOY.md: it is almost always the .js MIME type."
