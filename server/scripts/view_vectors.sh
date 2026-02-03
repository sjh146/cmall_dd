#!/bin/bash

# 벡터 데이터 조회 스크립트
# WSL에서 실행: bash server/scripts/view_vectors.sh

echo "=== cmall_dd 테이블 벡터 데이터 조회 ==="
echo ""

# 벡터가 있는 제품 수 확인
echo "1. 벡터 데이터 통계:"
sudo -u postgres psql -d cmall_dd -c "
SELECT 
    COUNT(*) as total_products,
    COUNT(embedding) as products_with_vectors,
    COUNT(*) - COUNT(embedding) as products_without_vectors
FROM cmall_dd;
"

echo ""
echo "2. 벡터가 있는 제품 목록:"
sudo -u postgres psql -d cmall_dd -c "
SELECT 
    id,
    name,
    category,
    CASE 
        WHEN embedding IS NULL THEN 'NULL'
        ELSE 'Vector(' || array_length(embedding::float[], 1) || ')'
    END as vector_info
FROM cmall_dd
ORDER BY id;
"

echo ""
echo "3. 벡터 데이터 샘플 (첫 5개 제품):"
sudo -u postgres psql -d cmall_dd -c "
SELECT 
    id,
    name,
    array_length(embedding::float[], 1) as vector_dimension,
    (embedding::float[])[1:5] as first_5_values
FROM cmall_dd
WHERE embedding IS NOT NULL
LIMIT 5;
"

