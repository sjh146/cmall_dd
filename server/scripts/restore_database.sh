#!/bin/bash

# PostgreSQL pgvector 데이터베이스 복원 스크립트
# 백업 위치: G 드라이브 (WSL에서 /mnt/g/로 접근)

# 사용법: ./restore_database.sh [백업파일경로]

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

# 백업 파일 지정
if [ -z "$1" ]; then
    # 백업 파일이 지정되지 않으면 가장 최근 백업 파일 사용
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -1)
    
    if [ -z "$BACKUP_FILE" ]; then
        echo "오류: 백업 파일을 찾을 수 없습니다."
        echo "사용법: $0 [백업파일경로]"
        exit 1
    fi
    
    echo "백업 파일이 지정되지 않아 가장 최근 백업 파일을 사용합니다:"
    echo "${BACKUP_FILE}"
    echo ""
else
    BACKUP_FILE="$1"
fi

# 백업 파일 존재 확인
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "오류: 백업 파일을 찾을 수 없습니다: ${BACKUP_FILE}"
    exit 1
fi

# 확인 메시지
echo "=========================================="
echo "PostgreSQL 데이터베이스 복원 시작"
echo "=========================================="
echo "데이터베이스: ${DB_NAME}"
echo "백업 파일: ${BACKUP_FILE}"
echo ""
echo "⚠️  경고: 기존 데이터베이스가 덮어씌워집니다!"
read -p "계속하시겠습니까? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "복원이 취소되었습니다."
    exit 0
fi

# 데이터베이스 삭제 및 재생성 (선택사항)
# 주의: 이 부분은 필요에 따라 주석 처리하세요
# dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
# createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"

# 복원 실행
echo ""
echo "복원 중..."

# PGPASSWORD 환경 변수 설정하여 비밀번호 자동 입력
export PGPASSWORD="${DB_PASSWORD}"

pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  -c \
  -v \
  "${BACKUP_FILE}"

# PGPASSWORD 환경 변수 제거 (보안)
unset PGPASSWORD

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "복원 완료!"
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "복원 실패!"
    echo "=========================================="
    exit 1
fi
