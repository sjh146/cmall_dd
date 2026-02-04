# PostgreSQL pgvector 데이터베이스 백업 스크립트 (PowerShell)
# 백업 위치: G 드라이브

# .env 파일 로드
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path (Split-Path -Parent $scriptDir) ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)\s*$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($key -and $value) {
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }
}

# 데이터베이스 설정 (환경 변수 또는 기본값)
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "cmall_dd" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }

# 백업 디렉토리 (G 드라이브)
$BACKUP_DIR = "G:\cmall_dd_backups"

# 백업 파일명 (타임스탬프 포함)
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = Join-Path $BACKUP_DIR "cmall_dd_backup_$TIMESTAMP.dump"

# G 드라이브 백업 디렉토리 생성
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL 데이터베이스 백업 시작" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "데이터베이스: $DB_NAME"
Write-Host "백업 위치: $BACKUP_FILE"
Write-Host ""

# WSL을 통해 pg_dump 실행
$wslCommand = "pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f /mnt/g/cmall_dd_backups/cmall_dd_backup_$TIMESTAMP.dump"

try {
    # WSL에서 백업 실행
    wsl bash -c "export PGPASSWORD='postgres'; $wslCommand"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "백업 완료!" -ForegroundColor Green
        Write-Host "백업 파일: $BACKUP_FILE" -ForegroundColor Green
        
        $fileInfo = Get-Item $BACKUP_FILE -ErrorAction SilentlyContinue
        if ($fileInfo) {
            $fileSize = "{0:N2} MB" -f ($fileInfo.Length / 1MB)
            Write-Host "파일 크기: $fileSize" -ForegroundColor Green
        }
        
        Write-Host "==========================================" -ForegroundColor Green
        
        # 최근 백업 파일 목록 표시
        Write-Host ""
        Write-Host "최근 백업 파일 목록:" -ForegroundColor Yellow
        Get-ChildItem -Path $BACKUP_DIR -Filter "*.dump" | 
            Sort-Object LastWriteTime -Descending | 
            Select-Object -First 5 | 
            Format-Table Name, Length, LastWriteTime -AutoSize
    } else {
        throw "백업 실패: pg_dump 실행 중 오류 발생"
    }
} catch {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "백업 실패!" -ForegroundColor Red
    Write-Host "오류: $_" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    exit 1
}
