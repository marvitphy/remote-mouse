@echo off
cd /d "%~dp0"
:loop
node server.js
echo Server stopped. Restarting in 2 seconds...
timeout /t 2 >nul
goto loop
