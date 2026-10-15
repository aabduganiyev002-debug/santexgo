@echo off
rem SantexGo - kompyuterda ishga tushirish. Shu faylni ikki marta bosing.
rem Hech narsa o'rnatish shart emas: Node.js va PostgreSQL "app" papkasining ichida.
rem To'xtatish: oynani yoping yoki SantexGo-toxtatish.bat ni bosing.
setlocal
chcp 65001 >nul
title SantexGo
cd /d "%~dp0"
if not exist "%~dp0app\node\node.exe" goto :not_extracted
"%~dp0app\node\node.exe" "%~dp0app\launcher\launcher.mjs" start
if errorlevel 1 goto :failed
exit /b 0

:not_extracted
echo.
echo  ZIP fayl ochilmagan yoki to'liq emas.
echo  ZIP faylni o'ng tugma bilan bosing - "Extract All" (Hammasini chiqarish),
echo  masalan C:\SantexGo papkasiga, keyin o'sha papkadagi SantexGo.bat ni bosing.
:failed
echo.
if "%SANTEXGO_NO_PAUSE%"=="1" exit /b 1
echo  Oynani yopish uchun istalgan tugmani bosing...
pause >nul
exit /b 1
