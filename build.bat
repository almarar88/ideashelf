@echo off
setlocal
REM ---------------------------------------------------------------
REM  Car App Manager - Windows build script
REM  1) creates a venv, 2) installs deps, 3) runs tests,
REM  4) builds a single-file exe with PyInstaller,
REM  5) builds an installer with Inno Setup if ISCC.exe is available.
REM ---------------------------------------------------------------
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (set PY=py -3) else (set PY=python)
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" || (
  echo Python 3.11 or newer is required. Install it from https://www.python.org/downloads/windows/ and tick "Add python.exe to PATH".
  exit /b 1
)

if not exist .venv (
  echo [1/5] Creating virtual environment...
  %PY% -m venv .venv || goto :fail
)
call .venv\Scripts\activate.bat

echo [2/5] Installing dependencies...
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt || goto :fail

echo [3/5] Running unit tests...
set QT_QPA_PLATFORM=offscreen
python -m pytest -q || goto :fail
set QT_QPA_PLATFORM=

echo [4/5] Generating icon and building CarAppManager.exe ...
python assets\make_icon.py
if exist build rmdir /s /q build
if exist dist\CarAppManager.exe del /q dist\CarAppManager.exe
python -m PyInstaller --noconfirm --clean CarAppManager.spec || goto :fail
echo     -> dist\CarAppManager.exe

echo [5/5] Installer (Inno Setup)...
set ISCC=
where ISCC.exe >nul 2>nul && set ISCC=ISCC.exe
if "%ISCC%"=="" if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set ISCC="%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if "%ISCC%"=="" if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set ISCC="%ProgramFiles%\Inno Setup 6\ISCC.exe"
if "%ISCC%"=="" (
  echo     Inno Setup not found - skipping installer. Install it from https://jrsoftware.org/isinfo.php and re-run build.bat
) else (
  %ISCC% installer\CarAppManager.iss || goto :fail
  echo     -> installer_output\CarAppManager-Setup.exe
)

echo.
echo Build finished.
exit /b 0

:fail
echo.
echo BUILD FAILED (see messages above).
exit /b 1
