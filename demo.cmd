@echo off
REM ============================================================================
REM  AgentGuard — One-Click Demo Launcher
REM  Builds all packages and starts the Core server + Dashboard
REM ============================================================================

echo.
echo  ========================================
echo   AgentGuard Demo Launcher
echo  ========================================
echo.

REM --- Step 1: Install dependencies ---
echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

REM --- Step 2: Build all packages ---
echo.
echo [2/4] Building all packages...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

REM --- Step 3: Start the Core MCP server (background) ---
echo.
echo [3/4] Starting AgentGuard Core server on port 3100...
start "AgentGuard Core" cmd /k "cd /d %~dp0packages\haas-core && npm start"

REM Give the server a moment to start
timeout /t 3 /nobreak >nul

REM --- Step 4: Start the Dashboard dev server (background) ---
echo.
echo [4/4] Starting Dashboard on http://localhost:5173...
start "AgentGuard Dashboard" cmd /k "cd /d %~dp0packages\haas-dashboard && npx vite --open"

echo.
echo  ========================================
echo   Demo is running!
echo  ========================================
echo.
echo   Dashboard:  http://localhost:5173
echo   Core API:   http://localhost:3100/health
echo.
echo   Click the "Run Demo" button on the Dashboard
echo   to simulate AI agent tool calls.
echo.
echo   Close this window or press Ctrl+C to stop.
echo  ========================================
echo.
pause
