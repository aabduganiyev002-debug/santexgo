@echo off
rem SantexGo - kompyuterda ishlayotgan saytni to'xtatish. Ma'lumotlar o'chmaydi.
setlocal
chcp 65001 >nul
title SantexGo - to'xtatish
cd /d "%~dp0"
"%~dp0app\node\node.exe" "%~dp0app\launcher\launcher.mjs" stop
set "CODE=%ERRORLEVEL%"
if "%SANTEXGO_NO_PAUSE%"=="1" exit /b %CODE%
echo.
echo  Oynani yopish uchun istalgan tugmani bosing...
pause >nul
exit /b %CODE%
