-- 예시 상품 등록 SQL 스크립트
-- 쇼핑몰에 샘플 상품 하나를 등록합니다.

-- 제품 정보 삽입
INSERT INTO cmall_dd (
    name, 
    price, 
    original_price, 
    image, 
    category, 
    condition, 
    description, 
    size, 
    brand, 
    color, 
    material
) VALUES (
    '클래식 데님 자켓',
    890000,
    1500000,
    '/images/sample-product.jpg',
    'jackets',
    'Excellent',
    '빈티지 스타일의 클래식 데님 자켓입니다. 내구성이 뛰어나고 다양한 스타일에 매치하기 좋습니다.',
    'M',
    'Levi''s',
    'blue',
    'denim'
)
RETURNING id, name, price;

