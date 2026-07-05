@echo off
setlocal
cd /d "%~dp0"
if not defined PORT set PORT=8000
"C:\Users\ethan\anaconda3\python.exe" "%~dp0server.py"
