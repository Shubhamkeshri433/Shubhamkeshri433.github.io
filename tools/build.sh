#!/bin/sh
# Bundles the vendored Three.js (r186) into js/vendor/three.bundle.js
# usage: THREE_SRC=/path/to/three.js ESBUILD=/path/to/esbuild tools/build.sh
set -e
cd "$(dirname "$0")/.."
: "${THREE_SRC:?set THREE_SRC to a three.js checkout}"
: "${ESBUILD:=esbuild}"
mkdir -p node_modules && rm -rf node_modules/three && ln -s "$THREE_SRC" node_modules/three
"$ESBUILD" tools/three-entry.js --bundle --format=esm --minify --tree-shaking=true \
  --outfile=js/vendor/three.bundle.js --log-level=warning
rm -rf node_modules
