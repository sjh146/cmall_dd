#!/bin/bash

# PostgreSQL pgvector 데이터베이스 백업 스크립트
# 백업 위치: G 드라이브 (WSL에서 /mnt/g/로 접근)

# 스크립트 위치에서 .env 파일 찾기
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# .env 파일이 있으면 로드
if [ -f "${ENV_FILE}" ]; then
    # .env 파일에서 환경 변수 로드 (주석과 빈 줄 제외)
    export $(grep -v '^#' "${ENV_FILE}" | grep -v '^$' | xargs)
fi

# 데이터베이스 설정 (환경 변수 또는 기본값)
DB_NAME="${DB_NAME:-cmall_dd}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

# 백업 디렉토리 (G 드라이브)
BACKUP_DIR="/mnt/g/cmall_dd_backups"

# 백업 파일명 (타임스탬프 포함)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cmall_dd_backup_${TIMESTAMP}.dump"

# G 드라이브 백업 디렉토리 생성
mkdir -p "${BACKUP_DIR}"

# 백업 실행
echo "=========================================="
echo "PostgreSQL 데이터베이스 백업 시작"
echo "=========================================="
echo "데이터베이스: ${DB_NAME}"
echo "백업 위치: ${BACKUP_FILE}"
echo ""

# PGPASSWORD 환경 변수 설정하여 비밀번호 자동 입력
export PGPASSWORD="${DB_PASSWORD}"

# pg_dump 실행 (custom format - 압축 및 복원에 유리)
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  -F c \
  -f "${BACKUP_FILE}"

# PGPASSWORD 환경 변수 제거 (보안)
unset PGPASSWORD

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "백업 완료!"
    echo "백업 파일: ${BACKUP_FILE}"
    echo "파일 크기: $(du -h "${BACKUP_FILE}" | cut -f1)"
    echo "=========================================="
    
    # 최근 백업 파일 목록 표시
    echo ""
    echo "최근 백업 파일 목록:"
    ls -lh "${BACKUP_DIR}"/*.dump 2>/dev/null | tail -5
else
    echo ""
    echo "=========================================="
    echo "백업 실패!"
    echo "=========================================="
    exit 1
fi
