@echo off
echo Starting TaskFlow Backend...
cd /d "%~dp0backend"
node index.js
pause
