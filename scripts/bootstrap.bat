@echo off
REM ==============================================================================
REM Ternfall Studio — Windows Environment Bootstrap & Health Check
REM ==============================================================================

echo.
echo ======================================================================
echo            TERNFALL STUDIO -- WINDOWS ENVIRONMENT BOOTSTRAP
echo ======================================================================
echo.

REM 1. Check Node.js
echo [1/4] Checking Node.js runtime...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js v20+ or v22+.
    pause
    exit /b 1
)
echo [OK] Node.js detected.

REM 2. Check FFmpeg
echo [2/4] Checking FFmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] FFmpeg not found in PATH. Install via: winget install Gyan.FFmpeg
) else (
    echo [OK] FFmpeg detected.
)

REM 3. Run Unit Tests
echo [3/4] Running core validation test suite...
call npx tsx --test src/**/*.test.ts
if %errorlevel% neq 0 (
    echo [ERROR] Tests failed.
    pause
    exit /b 1
)
echo [OK] All unit tests passed.

REM 4. Check Studio CLI
echo [4/4] Checking studio CLI...
call npm run studio -- doctor --json >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Studio CLI failed.
    pause
    exit /b 1
)
echo [OK] Studio CLI active.

echo.
echo ======================================================================
echo   All systems ready!
echo.
echo   To launch full-stack web studio:
echo     npm run dev
echo.
echo   To see turnkey agent guide:
echo     type AI_AGENT_START_GUIDE.md
echo ======================================================================
echo.
