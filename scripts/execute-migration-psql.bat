@echo off
REM Execute Evaluation Automation Migration via PSQL
REM This script connects directly to the PostgreSQL database and executes the migration

echo ============================================================================
echo Evaluation Automation Migration
echo ============================================================================
echo.

REM Load environment variables
for /f "tokens=1,2 delims==" %%a in (.env.local) do (
    if "%%a"=="SUPABASE_DB_HOST" set DB_HOST=%%b
    if "%%a"=="SUPABASE_DB_PORT" set DB_PORT=%%b
    if "%%a"=="SUPABASE_DB_NAME" set DB_NAME=%%b
    if "%%a"=="SUPABASE_DB_USER" set DB_USER=%%b
    if "%%a"=="SUPABASE_DB_PASSWORD" set DB_PASSWORD=%%b
)

echo Connecting to database...
echo Host: %DB_HOST%
echo Port: %DB_PORT%
echo Database: %DB_NAME%
echo User: %DB_USER%
echo.

set PGPASSWORD=%DB_PASSWORD%

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "scripts\migrations\001-create-evaluation-automation-tables.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================================
    echo Migration executed successfully!
    echo ============================================================================
) else (
    echo.
    echo ============================================================================
    echo Migration failed with error code: %ERRORLEVEL%
    echo ============================================================================
)

pause
