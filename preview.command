#!/bin/sh
# Double-click (macOS: right-click > Open the first time) to preview lexiko locally. Close the window to stop it.
cd "$(dirname "$0")"
command -v python3 >/dev/null && python3 tools/build_sw.py >/dev/null 2>&1   # keep the offline cache list in step with your changes
URL=http://localhost:8123/lexiko/
(sleep 1; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL")) &
if command -v node >/dev/null; then exec node tools/serve.js 8123
else echo "Node.js not found; using Python (no gzip, URL is the same only at /)."; URL=http://localhost:8123/; exec python3 -m http.server 8123; fi
