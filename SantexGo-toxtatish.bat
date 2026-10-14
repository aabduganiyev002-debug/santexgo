@echo off
rem ===========================================================================
rem  SantexGo - kompyuterda ishlayotgan saytni to'xtatish (Windows).
rem  Shu faylni ikki marta bosing.
rem
rem    1. Server oynasini - sayt, admin panel va API - yopadi
rem    2. "pnpm infra:down" - Docker'dagi PostgreSQL va Redis'ni to'xtatadi.
rem       Ma'lumotlar o'chmaydi: keyingi ishga tushirishda joyida bo'ladi.
rem  Qayta ishga tushirish: SantexGo-ishga-tushirish.bat
rem
rem  Avtomatik sinov (CI) uchun muhit o'zgaruvchilari:
rem    SANTEXGO_NO_DOCKER=1   Docker'ga tegilmaydi
rem    SANTEXGO_NO_PAUSE=1    oxirida pauza yo'q
rem  Xatoda 1 kodi bilan chiqadi.
rem
rem  Fayl faqat ASCII belgilardan va CRLF qator oxirlaridan iborat bo'lishi kerak:
rem  .gitattributes buni ta'minlaydi, CI tekshiradi. Aks holda cmd.exe uni buzib o'qiydi.
rem ===========================================================================
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title SantexGo - to'xtatish

set "PAUSE_ON_EXIT=1"
if "%SANTEXGO_NO_PAUSE%"=="1" set "PAUSE_ON_EXIT=0"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%POWERSHELL%" set "POWERSHELL=powershell"
set "EXIT_CODE=0"

pushd "%~dp0" || goto :wrong_folder
if not exist "package.json" goto :wrong_folder

echo.
echo  SantexGo to'xtatilmoqda...

rem -------------------------------------------------------------------- 1. Server
echo.
echo [1/2] Server...
rem Server oynasi buyruq qatoridagi "title SantexGo server" yozuvidan topiladi
rem (SantexGo-ishga-tushirish.bat shunday ochadi) va ichidagi barcha jarayonlar bilan
rem yopiladi. Server qo'lda ochilgan bo'lsa ham: 3000, 3001, 4000 va 5555-portlarni
rem band qilgan node jarayonlari to'xtatiladi. Natija: 0 - to'xtatildi, 2 - ishlamayotgan edi.
"%POWERSHELL%" -NoProfile -NonInteractive -Command "$found = 0; foreach ($p in @(Get-CimInstance Win32_Process -Filter 'Name=''cmd.exe''' | Where-Object { $_.CommandLine -like '*title SantexGo server*' })) { taskkill.exe /PID $p.ProcessId /T /F 2>&1 | Out-Null; $found++ }; foreach ($id in @(Get-NetTCPConnection -State Listen -LocalPort 3000, 3001, 4000, 5555 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) { $proc = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessName -eq 'node') { taskkill.exe /PID $id /T /F 2>&1 | Out-Null; $found++ } }; if ($found -gt 0) { exit 0 } else { exit 2 }"
set "STOP_CODE=%ERRORLEVEL%"
if "%STOP_CODE%"=="0" goto :server_stopped
if "%STOP_CODE%"=="2" goto :server_not_running
echo   Serverni to'xtatib bo'lmadi. Server oynasini qo'lda yoping.
set "EXIT_CODE=1"
goto :infra
:server_stopped
echo   OK: server to'xtatildi
goto :infra
:server_not_running
echo   Server ishlamayotgan ekan

rem ------------------------------------------------------------------- 2. Docker
:infra
echo.
echo [2/2] Baza va Redis - Docker...
if "%SANTEXGO_NO_DOCKER%"=="1" goto :infra_skip
if not exist ".env" goto :infra_not_set_up
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :docker_off
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :docker_off
if exist "%APPDATA%\npm\pnpm.cmd" set "PATH=%PATH%;%APPDATA%\npm"
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :infra_compose
call pnpm infra:down
if %ERRORLEVEL% NEQ 0 goto :infra_failed
goto :infra_ok
:infra_compose
rem pnpm topilmasa - "pnpm infra:down" ning o'zi (package.json)
docker compose --env-file .env -f docker/docker-compose.yml --profile s3 down --remove-orphans
if %ERRORLEVEL% NEQ 0 goto :infra_failed
:infra_ok
echo   OK: PostgreSQL va Redis to'xtatildi. Ma'lumotlar saqlanib qoldi.
echo   Docker Desktop ochiq qoladi - kerak bo'lmasa, uni ham yopishingiz mumkin.
goto :finish
:infra_skip
echo   O'tkazib yuborildi: SANTEXGO_NO_DOCKER=1
goto :finish
:infra_not_set_up
echo   SantexGo hali o'rnatilmagan - to'xtatadigan narsa yo'q.
goto :finish
:docker_off
echo   Docker ishlamayapti - baza allaqachon to'xtagan.
goto :finish
:infra_failed
echo   Docker xizmatlarini to'xtatib bo'lmadi - xato yuqorida.
set "EXIT_CODE=1"
goto :finish

:wrong_folder
echo.
echo  Bu fayl SantexGo loyiha papkasining ichida turishi kerak.
set "EXIT_CODE=1"

:finish
title SantexGo - to'xtatish
echo.
if "%EXIT_CODE%"=="0" echo  SantexGo to'xtatildi. Qayta ishga tushirish: SantexGo-ishga-tushirish.bat
if not "%EXIT_CODE%"=="0" echo  To'xtatishda xato bo'ldi. Xato matnini to'liq nusxalab Claude'ga yuboring.
if not "%PAUSE_ON_EXIT%"=="1" goto :end
echo.
echo  Oynani yopish uchun istalgan tugmani bosing...
pause >nul
:end
popd
exit /b %EXIT_CODE%
