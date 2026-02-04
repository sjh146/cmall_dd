#!/bin/bash

# 백업 파일에 pgvector 데이터가 포함되어 있는지 확인하는 스크립트

# 사용법: ./verify_backup.sh [백업파일경로]

# 스크립트 위치에서 .env 파일 찾기
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# .env 파일이 있으면 로드
if [ -f "${ENV_FILE}" ]; then
    export $(grep -v '^#' "${ENV_FILE}" | grep -v '^$' | xargs)
fi

# 백업 파일 지정
if [ -z "$1" ]; then
    # 백업 파일이 지정되지 않으면 가장 최근 백업 파일 사용
    BACKUP_DIR="/mnt/g/cmall_dd_backups"
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

DB_PASSWORD="${DB_PASSWORD:-postgres}"
export PGPASSWORD="${DB_PASSWORD}"

echo "=========================================="
echo "백업 파일 검증: pgvector 데이터 확인"
echo "=========================================="
echo "백업 파일: ${BACKUP_FILE}"
echo ""

# pg_restore를 사용하여 백업 파일의 내용 확인
# --list 옵션으로 백업 파일의 내용을 나열
echo "백업 파일 내용 분석 중..."
echo ""

# 백업 파일에서 테이블과 데이터 확인
pg_restore --list "${BACKUP_FILE}" | grep -E "(TABLE DATA|EXTENSION|vector)" | head -20

echo ""
echo "=========================================="
echo "백업 파일에서 cmall_dd 테이블 데이터 확인:"
echo "=========================================="

# 백업 파일에서 embedding 컬럼이 있는지 확인
if pg_restore --list "${BACKUP_FILE}" | grep -q "cmall_dd"; then
    echo "✓ cmall_dd 테이블이 백업에 포함되어 있습니다."
    
    # pgvector 확장 확인
    if pg_restore --list "${BACKUP_FILE}" | grep -q "vector"; then
        echo "✓ pgvector 확장이 백업에 포함되어 있습니다."
    else
        echo "⚠ pgvector 확장이 백업에 포함되지 않았을 수 있습니다."
    fi
    
    # 테이블 데이터 확인
    if pg_restore --list "${BACKUP_FILE}" | grep -q "TABLE DATA cmall_dd"; then
        echo "✓ cmall_dd 테이블 데이터가 백업에 포함되어 있습니다."
        echo ""
        echo "백업 파일 크기: $(du -h "${BACKUP_FILE}" | cut -f1)"
        echo ""
        echo "참고: embedding 컬럼(vector 타입)은 테이블 데이터와 함께 백업됩니다."
        echo "복원 시 pgvector 확장이 활성화되어 있어야 합니다."
    else
        echo "⚠ cmall_dd 테이블 데이터가 백업에 포함되지 않았을 수 있습니다."
    fi
else
    echo "✗ cmall_dd 테이블을 찾을 수 없습니다."
fi

unset PGPASSWORD

echo ""
echo "=========================================="
echo "검증 완료"
echo "=========================================="
