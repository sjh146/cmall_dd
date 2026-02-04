@echo off
REM PostgreSQL pgvector 데이터베이스 백업 스크립트 (Batch)
REM 백업 위치: G 드라이브

REM 데이터베이스 설정
set DB_NAME=cmall_dd
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432

REM 백업 디렉토리 (G 드라이브)
set BACKUP_DIR=G:\cmall_dd_backups

REM 백업 파일명 (타임스탬프 포함)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=%BACKUP_DIR%\cmall_dd_backup_%TIMESTAMP%.dump

REM G 드라이브 백업 디렉토리 생성
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ==========================================
echo PostgreSQL 데이터베이스 백업 시작
echo ==========================================
echo 데이터베이스: %DB_NAME%
echo 백업 위치: %BACKUP_FILE%
echo.

REM WSL을 통해 pg_dump 실행
wsl bash -c "export PGPASSWORD='postgres'; pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f /mnt/g/cmall_dd_backups/cmall_dd_backup_%TIMESTAMP%.dump"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo 백업 완료!
    echo 백업 파일: %BACKUP_FILE%
    echo ==========================================
    echo.
    echo 최근 백업 파일 목록:
    dir /O-D "%BACKUP_DIR%\*.dump" | findstr /C:"cmall_dd_backup"
) else (
    echo.
    echo ==========================================
    echo 백업 실패!
    echo ==========================================
    exit /b 1
)
