@echo off
rem Double-click to preview lexiko locally. Close this window to stop it.
cd /d "%~dp0"
where python >nul 2>nul && python tools\build_sw.py >nul 2>nul
start "" http://localhost:8123/lexiko/
where node >nul 2>nul && (node tools\serve.js 8123 & goto :eof)
echo Node.js not found; using Python.
start "" http://localhost:8123/
python -m http.server 8123
