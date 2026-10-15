@echo off
rem SantexGo - admin telefon raqami va parolini o'rnatish (unutilgan parolni tiklash ham).
rem Raqam va yangi parolni so'raydi, keyin SantexGo'ni ishga tushiradi (SantexGo.bat kabi).
setlocal
chcp 65001 >nul
title SantexGo - admin sozlash
cd /d "%~dp0"
if not exist "%~dp0app\node\node.exe" goto :not_extracted
"%~dp0app\node\node.exe" "%~dp0app\launcher\launcher.mjs" admin
if errorlevel 1 goto :failed
exit /b 0

:not_extracted
echo.
echo  ZIP fayl ochilmagan yoki to'liq emas.
echo  ZIP faylni o'ng tugma bilan bosing - "Extract All" (Hammasini chiqarish),
echo  masalan C:\SantexGo papkasiga, keyin o'sha papkadagi Admin-sozlash.bat ni bosing.
:failed
echo.
if "%SANTEXGO_NO_PAUSE%"=="1" exit /b 1
echo  Oynani yopish uchun istalgan tugmani bosing...
pause >nul
exit /b 1
