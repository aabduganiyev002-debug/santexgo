@echo off
rem ===========================================================================
rem  SantexGo - kompyuterda ishga tushirish (Windows). Shu faylni ikki marta bosing.
rem
rem  Nima qiladi:
rem    1. Node.js 22.12 yoki yangisi borligini tekshiradi
rem    2. pnpm'ni tekshiradi, yo'q bo'lsa o'rnatadi
rem    3. Docker Desktop'ni ochadi va tayyor bo'lishini kutadi
rem    4. "pnpm setup:local" - sozlamalar, bog'liqliklar, baza, migratsiyalar, katalog
rem    5. "pnpm dev" ni alohida server oynasida ishga tushiradi va sayt hamda
rem       admin panelni brauzerda ochadi
rem  Server allaqachon ishlayotgan bo'lsa, faqat brauzer ochiladi.
rem  To'xtatish: SantexGo-toxtatish.bat
rem
rem  Avtomatik sinov (CI) uchun muhit o'zgaruvchilari:
rem    SANTEXGO_NO_DOCKER=1   Docker tekshirilmaydi: "pnpm setup:local --no-docker"
rem    SANTEXGO_NO_DEV=1      setup'dan keyin to'xtaydi: server, brauzer va pauza yo'q
rem    SANTEXGO_NO_BROWSER=1  brauzer ochilmaydi
rem    SANTEXGO_NO_PAUSE=1    oxirida va xatoda pauza yo'q
rem    SANTEXGO_DEV_LOG=fayl  server chiqishi oyna o'rniga shu faylga yoziladi
rem  Har qanday xatoda 1 kodi bilan chiqadi.
rem
rem  Fayl faqat ASCII belgilardan va CRLF qator oxirlaridan iborat bo'lishi kerak:
rem  .gitattributes buni ta'minlaydi, CI tekshiradi. Aks holda cmd.exe uni buzib o'qiydi.
rem ===========================================================================
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title SantexGo

set "PAUSE_ON_EXIT=1"
if "%SANTEXGO_NO_PAUSE%"=="1" set "PAUSE_ON_EXIT=0"
if "%SANTEXGO_NO_DEV%"=="1" set "PAUSE_ON_EXIT=0"
set "OPEN_BROWSER=1"
if "%SANTEXGO_NO_BROWSER%"=="1" set "OPEN_BROWSER=0"
if "%SANTEXGO_NO_DEV%"=="1" set "OPEN_BROWSER=0"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%POWERSHELL%" set "POWERSHELL=powershell"

pushd "%~dp0" || goto :wrong_folder
if not exist "package.json" goto :wrong_folder

echo.
echo  ==========================================
echo    SantexGo - kompyuterda ishga tushirish
echo  ==========================================

rem ------------------------------------------------------------------ 1. Node.js
echo.
echo [1/5] Node.js tekshirilmoqda...
set "NODE_VERSION="
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :node_missing
for /f "delims=" %%v in ('node -v 2^>nul ^| findstr /r "^v[0-9]"') do set "NODE_VERSION=%%v"
if not defined NODE_VERSION goto :node_missing
set "NODE_MAJOR=0"
set "NODE_MINOR=0"
for /f "tokens=1,2 delims=v." %%a in ("%NODE_VERSION%") do (
  set "NODE_MAJOR=%%a"
  set "NODE_MINOR=%%b"
)
if "%NODE_MINOR%"=="" set "NODE_MINOR=0"
if %NODE_MAJOR% LSS 22 goto :node_old
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% LSS 12 goto :node_old
echo   OK: Node.js %NODE_VERSION%

rem --------------------------------------------------------------------- 2. pnpm
echo.
echo [2/5] pnpm tekshirilmoqda...
rem npm global papkasi PATH'da bo'lmasa ham pnpm topilsin
if exist "%APPDATA%\npm\pnpm.cmd" set "PATH=%PATH%;%APPDATA%\npm"
call :find_pnpm
if "%PNPM_OK%"=="1" goto :pnpm_ok
echo   pnpm topilmadi yoki eski. O'rnatilmoqda: npm install -g pnpm@10.28.0
echo   Administrator huquqi kerak emas. Bir-ikki daqiqa kuting...
call npm install -g pnpm@10.28.0
if %ERRORLEVEL% NEQ 0 goto :pnpm_install_failed
rem Yangi o'rnatilgan pnpm shu oyna uchun PATH'da hali bo'lmasligi mumkin
set "NPM_PREFIX="
for /f "delims=" %%p in ('npm prefix -g 2^>nul') do set "NPM_PREFIX=%%p"
if defined NPM_PREFIX set "PATH=%NPM_PREFIX%;%PATH%"
call :find_pnpm
if not "%PNPM_OK%"=="1" goto :pnpm_new_window
:pnpm_ok
rem pnpm.cmd oyna sarlavhasini o'zgartiradi - qaytaramiz
title SantexGo
echo   OK: pnpm %PNPM_VERSION%

rem ------------------------------------------------- Server allaqachon ishlayaptimi?
if "%SANTEXGO_NO_DEV%"=="1" goto :docker
"%POWERSHELL%" -NoProfile -NonInteractive -Command "try { $c = New-Object Net.Sockets.TcpClient; if ($c.ConnectAsync('localhost', 3000).Wait(3000)) { exit 0 } } catch { }; exit 1"
if %ERRORLEVEL% NEQ 0 goto :docker
echo.
echo  SantexGo allaqachon ishlayapti - sayt va admin panel brauzerda ochiladi.
echo  Qayta ishga tushirish kerak bo'lsa: avval SantexGo-toxtatish.bat, keyin shu fayl.
call :open_browser
goto :done

rem ------------------------------------------------------------------- 3. Docker
:docker
echo.
echo [3/5] Docker tekshirilmoqda...
set "SETUP_ARGS="
if "%SANTEXGO_NO_DOCKER%"=="1" goto :docker_skip
set "DOCKER_DIR=%ProgramFiles%\Docker\Docker"
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :docker_check
if not exist "%DOCKER_DIR%\resources\bin\docker.exe" goto :docker_missing
rem Docker yangi o'rnatilgan: docker buyrug'i shu oyna uchun PATH'da hali yo'q
set "PATH=%DOCKER_DIR%\resources\bin;%PATH%"
:docker_check
docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :docker_ok
if not exist "%DOCKER_DIR%\Docker Desktop.exe" goto :docker_not_running
echo   Docker Desktop ochilmoqda. Tayyor bo'lishini kutamiz - 3 daqiqagacha.
echo   Docker oynasida shartlarni qabul qilish so'ralsa, Accept ni bosing.
start "" "%DOCKER_DIR%\Docker Desktop.exe"
set /a DOCKER_WAITED=0
:docker_wait
rem ping - 10 soniya kutish; timeout buyrug'i CI'da, kirish qayta yo'naltirilganda ishlamaydi
ping -n 11 127.0.0.1 >nul
set /a DOCKER_WAITED+=10
docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :docker_ok
if %DOCKER_WAITED% GEQ 180 goto :docker_timeout
echo   ... %DOCKER_WAITED% soniya
goto :docker_wait
:docker_skip
echo   O'tkazib yuborildi: SANTEXGO_NO_DOCKER=1
set "SETUP_ARGS=--no-docker"
goto :setup
:docker_ok
echo   OK: Docker ishlayapti

rem ------------------------------------------------------------------ 4. Sozlash
:setup
echo.
echo [4/5] Sozlash: pnpm setup:local %SETUP_ARGS%
echo   Birinchi marta 5-10 daqiqa ketadi, keyingi safar tezroq.
set "FIRST_RUN=0"
if not exist "apps\api\.env" set "FIRST_RUN=1"
call pnpm setup:local %SETUP_ARGS%
if %ERRORLEVEL% NEQ 0 goto :setup_failed
title SantexGo
if "%SANTEXGO_NO_DEV%"=="1" goto :setup_only
if not "%FIRST_RUN%"=="1" goto :start_server
if not "%PAUSE_ON_EXIT%"=="1" goto :start_server
echo.
echo  MUHIM: yuqorida chiqqan admin telefon raqami va parolini yozib oling.
echo  Ular apps\api\.env faylida ham saqlangan: ADMIN_PHONE va ADMIN_PASSWORD qatorlari.
echo  Yozib olgach, davom etish uchun istalgan tugmani bosing...
pause >nul

rem -------------------------------------------------------------------- 5. Server
:start_server
echo.
echo [5/5] Server alohida oynada ishga tushirilmoqda...
set "DEV_COMMAND=pnpm dev"
if defined SANTEXGO_DEV_LOG set "DEV_COMMAND=pnpm dev >"%SANTEXGO_DEV_LOG%" 2>&1"
rem Start-Process: yangi oyna bu oynaning ochiq fayllarini meros qilib olmaydi (CI osilib
rem qolmaydi). SantexGo-toxtatish.bat oynani buyruq qatoridagi "title SantexGo server"
rem yozuvidan topadi - uni o'zgartirsangiz, u yerda ham o'zgartiring.
"%POWERSHELL%" -NoProfile -NonInteractive -Command "Start-Process -FilePath $env:ComSpec -ArgumentList ('/k title SantexGo server& echo SantexGo server: bu oynani yopmang, sayt shu oyna ochiq turganda ishlaydi.& ' + $env:DEV_COMMAND)"
if %ERRORLEVEL% NEQ 0 goto :server_start_failed
echo   Sayt tayyor bo'lishini kutamiz - birinchi marta 1-3 daqiqa...
"%POWERSHELL%" -NoProfile -NonInteractive -Command "$ProgressPreference = 'SilentlyContinue'; $deadline = (Get-Date).AddMinutes(5); foreach ($url in 'http://127.0.0.1:4000/api/health', 'http://localhost:3000/') { while ($true) { try { $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 120; break } catch { if ($_.Exception.Response) { break } }; if ((Get-Date) -gt $deadline) { exit 1 }; Write-Host -NoNewline '.'; Start-Sleep -Seconds 3 } }; Write-Host ''; exit 0"
if %ERRORLEVEL% NEQ 0 goto :server_timeout
call :open_browser
echo.
echo  =====================================================================
echo   SantexGo ishlayapti!
echo.
echo   Sayt:         http://localhost:3000
echo   Admin panel:  http://localhost:3001
echo   API hujjati:  http://localhost:4000/api/docs
echo.
echo   Admin panelga kirish: telefon raqam va birinchi parol apps\api\.env
echo   faylida - ADMIN_PHONE va ADMIN_PASSWORD qatorlari. Bloknot bilan oching.
echo.
echo   SMS kodlar: kompyuterda haqiqiy SMS yuborilmaydi. Kod server oynasida
echo   chiqadi, masalan: +998901234567: SantexGo: ro'yxatdan o'tish kodi 482913
echo.
echo   Server oynasini yopmang. To'xtatish: SantexGo-toxtatish.bat
echo  =====================================================================
goto :done

rem -------------------------------------------------------------------- Xatolar
:wrong_folder
echo.
echo  Bu fayl SantexGo loyiha papkasining ichida turishi kerak.
echo  Kodni GitHub Desktop orqali yuklab oling - docs\ORNATISH.md, 2-qadam.
echo  ZIP qilib yuklagan bo'lsangiz, avval arxivni oching: Extract All.
goto :fail

:node_missing
echo.
echo  Node.js topilmadi.
echo  nodejs.org saytidan Node.js 24 LTS versiyasini o'rnating - sayt hozir ochiladi.
echo  O'rnatishda hamma savollarga standart javobni qoldirib, Next bosing.
echo  Keyin shu faylni yana ikki marta bosing.
call :open_url https://nodejs.org
goto :fail

:node_old
echo.
echo  Node.js %NODE_VERSION% juda eski: kamida 22.12 kerak.
echo  nodejs.org saytidan Node.js 24 LTS versiyasini o'rnating - sayt hozir ochiladi.
echo  Keyin shu faylni yana ikki marta bosing.
call :open_url https://nodejs.org
goto :fail

:pnpm_install_failed
echo.
echo  pnpm o'rnatilmadi. Internet ulanishini tekshiring va shu faylni yana bosing.
echo  Qo'lda o'rnatish: docs\ORNATISH.md, 4-qadam.
goto :fail

:pnpm_new_window
echo.
echo  pnpm o'rnatildi, lekin bu oyna uni hali ko'rmayapti.
echo  Shu oynani yoping va SantexGo-ishga-tushirish.bat faylini yana ikki marta bosing.
goto :fail

:docker_missing
echo.
echo  Docker Desktop topilmadi. Sayt bazasi - PostgreSQL - Docker ichida ishlaydi.
echo  Docker Desktop'ni o'rnating - sayt hozir ochiladi. O'rnatgach, kompyuterni qayta
echo  ishga tushiring va shu faylni yana ikki marta bosing.
call :open_url https://www.docker.com/products/docker-desktop
goto :fail

:docker_not_running
echo.
echo  Docker ishlamayapti. Docker Desktop'ni oching, pastda yashil "Engine running"
echo  yozuvi chiqquncha kuting va shu faylni yana ikki marta bosing.
goto :fail

:docker_timeout
echo.
echo  Docker Desktop 3 daqiqada tayyor bo'lmadi.
echo  Docker Desktop oynasini oching: shartlarni qabul qilish yoki WSL'ni yangilash
echo  so'ralgan bo'lishi mumkin. Pastda yashil "Engine running" chiqqach, shu faylni
echo  yana ikki marta bosing. WSL yoki Virtualization xatosi bo'lsa: docs\ORNATISH.md,
echo  "Muammolar va yechimlar" bo'limi.
goto :fail

:setup_failed
echo.
echo  Sozlash xato bilan tugadi. Sababi va yechimi yuqorida yozilgan:
echo  qizil xato matni va "Nima qilish kerak" qatori.
goto :fail

:server_start_failed
echo.
echo  Server oynasini ochib bo'lmadi.
echo  Qo'lda: shu papkada terminal oching va pnpm dev buyrug'ini bering.
goto :fail

:server_timeout
echo.
echo  Sayt 5 daqiqada ishga tushmadi.
echo  Server oynasidagi yozuvlarni o'qing - xato o'sha yerda bo'ladi.
goto :fail

:setup_only
echo.
echo  Tayyor. Server ishga tushirilmadi: SANTEXGO_NO_DEV=1.
goto :done

:fail
echo.
echo  Muammo hal bo'lgach, shu faylni yana ikki marta bosing.
echo  Tushunarsiz bo'lsa, oynadagi xato matnini to'liq nusxalab Claude'ga yuboring.
call :maybe_pause
popd
exit /b 1

:done
call :maybe_pause
popd
exit /b 0

rem ---------------------------------------------------------- Yordamchi qismlar
rem pnpm bormi va versiyasi 10 yoki yangiroqmi: PNPM_OK=1
:find_pnpm
set "PNPM_OK=0"
set "PNPM_VERSION="
set "PNPM_MAJOR=0"
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 exit /b 0
for /f "delims=" %%v in ('pnpm --version 2^>nul ^| findstr /r "^[0-9]"') do set "PNPM_VERSION=%%v"
if not defined PNPM_VERSION exit /b 0
for /f "tokens=1 delims=." %%a in ("%PNPM_VERSION%") do set "PNPM_MAJOR=%%a"
if %PNPM_MAJOR% GEQ 10 set "PNPM_OK=1"
exit /b 0

:open_browser
call :open_url http://localhost:3000
call :open_url http://localhost:3001
exit /b 0

:open_url
if not "%OPEN_BROWSER%"=="1" exit /b 0
start "" "%~1"
exit /b 0

:maybe_pause
if not "%PAUSE_ON_EXIT%"=="1" exit /b 0
echo.
echo  Oynani yopish uchun istalgan tugmani bosing...
pause >nul
exit /b 0
