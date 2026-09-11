#!/bin/bash
# Build the zip that goes on the web host: exactly the files the site serves,
# and nothing else. Run from anywhere.
#
#   ./tools/pack.sh            -> ClouterX-<build>.zip next to the repo
#   ./tools/pack.sh /some/dir  -> puts it there instead
#
# api/config.php holds the stats password and is not in git, so the zip is the
# only place it travels. If it is missing here the example goes in instead, and
# the panel stays shut until a password is put in it — that is the safe default
# for a file nobody should be guessing at.

set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="${1:-$(cd .. && pwd)}"
BUILD=$(sed -n "s/^export const BUILD = '\(.*\)';/\1/p" src/state.js)
[ -n "$BUILD" ] || { echo "Could not read BUILD from src/state.js" >&2; exit 1; }
ZIP="$OUT_DIR/ClouterX-$BUILD.zip"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
ROOT="$STAGE/ClouterX"
mkdir -p "$ROOT/src/data" "$ROOT/styles" "$ROOT/api"

cp index.html privatliv.html "$ROOT/"
cp src/*.js "$ROOT/src/"
cp src/data/*.js "$ROOT/src/data/"
cp styles/main.css "$ROOT/styles/"
cp api/lib.php api/track.php api/stats.php "$ROOT/api/"
cp tools/htaccess.txt "$ROOT/.htaccess"
cp DEPLOY.md "$ROOT/"

if [ -f api/config.php ]; then
  cp api/config.php "$ROOT/api/config.php"
  SECRET="with your password in api/config.php"
else
  cp api/config.example.php "$ROOT/api/config.php"
  SECRET="WITHOUT a password — open api/config.php and set one"
fi

rm -f "$ZIP"
( cd "$STAGE" && zip -qr "$ZIP" ClouterX )
echo "$ZIP"
echo "build $BUILD, $(find "$ROOT" -type f | wc -l | tr -d ' ') files, $(du -h "$ZIP" | cut -f1), $SECRET"
