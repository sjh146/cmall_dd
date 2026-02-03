-- 벡터 데이터 조회 스크립트
-- cmall_dd 테이블의 embedding 벡터 데이터를 확인합니다.

-- 1. 벡터가 있는 제품 수 확인
SELECT 
    COUNT(*) as total_products,
    COUNT(embedding) as products_with_vectors,
    COUNT(*) - COUNT(embedding) as products_without_vectors
FROM cmall_dd;

-- 2. 벡터가 있는 제품들의 기본 정보와 벡터 차원 확인
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

-- 3. 벡터 데이터의 첫 10개 값만 보기 (전체 1536차원은 너무 길기 때문)
SELECT 
    id,
    name,
    CASE 
        WHEN embedding IS NULL THEN NULL
        ELSE embedding::text
    END as embedding_preview
FROM cmall_dd
WHERE embedding IS NOT NULL
LIMIT 5;

-- 4. 벡터의 통계 정보 (벡터가 있는 경우)
SELECT 
    id,
    name,
    array_length(embedding::float[], 1) as vector_dimension,
    array_length(embedding::float[], 1) = 1536 as is_correct_dimension
FROM cmall_dd
WHERE embedding IS NOT NULL;

-- 5. 벡터의 첫 번째와 마지막 값 확인
SELECT 
    id,
    name,
    (embedding::float[])[1] as first_value,
    (embedding::float[])[1536] as last_value,
    array_length(embedding::float[], 1) as dimension
FROM cmall_dd
WHERE embedding IS NOT NULL
LIMIT 5;

