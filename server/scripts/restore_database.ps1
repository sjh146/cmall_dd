# PostgreSQL pgvector 데이터베이스 복원 스크립트 (PowerShell)
# 백업 위치: G 드라이브

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile
)

# 데이터베이스 설정 (필요시 수정)
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "cmall_dd" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }

# 백업 디렉토리 (G 드라이브)
$BACKUP_DIR = "G:\cmall_dd_backups"

# 백업 파일 지정
if ([string]::IsNullOrEmpty($BackupFile)) {
    # 백업 파일이 지정되지 않으면 가장 최근 백업 파일 사용
    $latestBackup = Get-ChildItem -Path $BACKUP_DIR -Filter "*.dump" | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 1
    
    if (-not $latestBackup) {
        Write-Host "오류: 백업 파일을 찾을 수 없습니다." -ForegroundColor Red
        Write-Host "사용법: .\restore_database.ps1 [-BackupFile '경로']" -ForegroundColor Yellow
        exit 1
    }
    
    $BackupFile = $latestBackup.FullName
    Write-Host "백업 파일이 지정되지 않아 가장 최근 백업 파일을 사용합니다:" -ForegroundColor Yellow
    Write-Host $BackupFile -ForegroundColor Yellow
    Write-Host ""
}

# 백업 파일 존재 확인
if (-not (Test-Path $BackupFile)) {
    Write-Host "오류: 백업 파일을 찾을 수 없습니다: $BackupFile" -ForegroundColor Red
    exit 1
}

# 확인 메시지
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL 데이터베이스 복원 시작" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "데이터베이스: $DB_NAME"
Write-Host "백업 파일: $BackupFile"
Write-Host ""
Write-Host "⚠️  경고: 기존 데이터베이스가 덮어씌워집니다!" -ForegroundColor Yellow
$confirm = Read-Host "계속하시겠습니까? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "복원이 취소되었습니다." -ForegroundColor Yellow
    exit 0
}

# WSL 경로로 변환
$wslBackupFile = $BackupFile -replace '^G:\\', '/mnt/g/'
$wslBackupFile = $wslBackupFile -replace '\\', '/'

# 복원 실행
Write-Host ""
Write-Host "복원 중..." -ForegroundColor Yellow

$wslCommand = "export PGPASSWORD='postgres'; pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c -v `"$wslBackupFile`""

try {
    wsl bash -c $wslCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "복원 완료!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
    } else {
        throw "복원 실패: pg_restore 실행 중 오류 발생"
    }
} catch {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "복원 실패!" -ForegroundColor Red
    Write-Host "오류: $_" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    exit 1
}
