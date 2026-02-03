# 상품 등록 가이드

쇼핑몰에 상품을 등록하는 방법은 3가지가 있습니다.

## 방법 1: 이미지 파일 기반 자동 등록 (권장)

`public/images` 폴더에 있는 이미지 파일을 자동으로 읽어서 상품으로 등록하고 벡터 임베딩을 생성합니다.

### 사용 방법

```bash
# Windows PowerShell
cd server
.\scripts\seed_images.bat

# 또는 직접 실행
go run cmd/seed_images/main.go

# WSL/Linux
cd server
bash scripts/seed_images.sh
```

### 제품 정보 매핑

스크립트는 이미지 파일명을 기반으로 제품 정보를 자동 매핑합니다:

- `frame_1-30.jpg` → Celana Jeans Vintage Levi's 501
- `frame_2-00.jpg` → Kaos Band Vintage
- `frame_2-30.jpg` → Blazer Wol
- `frame_3-00.jpg` → Dress Musim Panas Motif Bunga
- `frame_3-20.jpg` → Celana Chino Khaki
- `frame_4-00.jpg` → Sweater Oversized

### 특징

- ✅ 이미지 파일을 자동으로 스캔
- ✅ 벡터 임베딩 자동 생성 (1536차원)
- ✅ 기존 제품이 있으면 임베딩만 업데이트
- ✅ 외부 API 불필요 (로컬 임베딩 생성)

---

## 방법 2: REST API를 통한 등록

백엔드 서버가 실행 중일 때 HTTP API를 사용하여 상품을 등록할 수 있습니다.

### 서버 실행 확인

```bash
cd server
go run main.go
```

서버가 `http://localhost:8080`에서 실행되어야 합니다.

### API 엔드포인트

**POST** `http://localhost:8080/api/v1/products`

### 요청 예시

#### cURL 사용

```bash
curl -X POST http://localhost:8080/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "새로운 상품명",
    "price": 500000,
    "originalPrice": 1000000,
    "image": "/images/product.jpg",
    "category": "pants",
    "condition": "Good",
    "description": "상품 설명",
    "size": "M",
    "brand": "브랜드명",
    "color": "blue",
    "material": "cotton"
  }'
```

#### PowerShell 사용

```powershell
$body = @{
    name = "새로운 상품명"
    price = 500000
    originalPrice = 1000000
    image = "/images/product.jpg"
    category = "pants"
    condition = "Good"
    description = "상품 설명"
    size = "M"
    brand = "브랜드명"
    color = "blue"
    material = "cotton"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/products" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

#### JavaScript/Fetch 사용

```javascript
fetch('http://localhost:8080/api/v1/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: '새로운 상품명',
    price: 500000,
    originalPrice: 1000000,
    image: '/images/product.jpg',
    category: 'pants',
    condition: 'Good',
    description: '상품 설명',
    size: 'M',
    brand: '브랜드명',
    color: 'blue',
    material: 'cotton'
  })
})
.then(response => response.json())
.then(data => console.log('상품 등록 완료:', data));
```

### 필수 필드

- `name` (string, 필수): 상품명
- `price` (integer, 필수): 판매 가격

### 선택 필드

- `originalPrice` (integer): 원래 가격 (할인 표시용)
- `image` (string): 이미지 경로
- `category` (string): 카테고리 (pants, shirts, jackets, dresses 등)
- `condition` (string): 상태 (Excellent, Good, Fair)
- `description` (string): 상품 설명
- `size` (string): 사이즈
- `brand` (string): 브랜드명
- `color` (string): 색상
- `material` (string): 소재

### 응답 예시

```json
{
  "id": 1,
  "name": "새로운 상품명",
  "price": 500000,
  "originalPrice": 1000000,
  "image": "/images/product.jpg",
  "category": "pants",
  "condition": "Good",
  "description": "상품 설명",
  "size": "M",
  "brand": "브랜드명",
  "color": "blue",
  "material": "cotton",
  "createdAt": "2026-02-03T16:00:00Z",
  "updatedAt": "2026-02-03T16:00:00Z"
}
```

### 주의사항

- ⚠️ API를 통한 등록은 벡터 임베딩을 생성하지 않습니다
- 벡터 임베딩이 필요하면 방법 1(스크립트)을 사용하거나, 별도로 업데이트해야 합니다

---

## 방법 3: SQL 직접 실행

데이터베이스에 직접 SQL을 실행하여 상품을 등록할 수 있습니다.

### WSL에서 실행

```bash
sudo -u postgres psql -d cmall_dd
```

### SQL 예시

```sql
-- 기본 상품 등록 (임베딩 없음)
INSERT INTO cmall_dd (
    name, price, original_price, image, category, condition,
    description, size, brand, color, material
) VALUES (
    '새로운 상품명',
    500000,
    1000000,
    '/images/product.jpg',
    'pants',
    'Good',
    '상품 설명',
    'M',
    '브랜드명',
    'blue',
    'cotton'
);

-- 임베딩 포함 상품 등록
INSERT INTO cmall_dd (
    name, price, original_price, image, category, condition,
    description, size, brand, color, material, embedding
) VALUES (
    '새로운 상품명',
    500000,
    1000000,
    '/images/product.jpg',
    'pants',
    'Good',
    '상품 설명',
    'M',
    '브랜드명',
    'blue',
    'cotton',
    '[0.1,0.2,0.3,...]'::vector(1536)  -- 1536차원 벡터
);
```

### 벡터 임베딩 생성

임베딩을 생성하려면 Go 스크립트를 사용하거나, 다른 방법으로 벡터를 생성해야 합니다.

---

## 상품 정보 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 상품명 |
| `price` | integer | ✅ | 판매 가격 (원 단위) |
| `originalPrice` | integer | ❌ | 원래 가격 (할인 표시용) |
| `image` | string | ❌ | 이미지 경로 (`/images/...`) |
| `category` | string | ❌ | 카테고리: `pants`, `shirts`, `jackets`, `dresses` |
| `condition` | string | ❌ | 상태: `Excellent`, `Good`, `Fair` |
| `description` | string | ❌ | 상품 설명 |
| `size` | string | ❌ | 사이즈 (예: `M`, `32W x 32L`) |
| `brand` | string | ❌ | 브랜드명 |
| `color` | string | ❌ | 색상 |
| `material` | string | ❌ | 소재 (예: `cotton`, `denim`, `wool`) |
| `embedding` | vector(1536) | ❌ | 벡터 임베딩 (AI 검색용) |

---

## 권장 방법

1. **대량 등록**: 방법 1 (이미지 파일 기반 스크립트)
   - 여러 이미지를 한 번에 등록
   - 벡터 임베딩 자동 생성

2. **개별 등록**: 방법 2 (REST API)
   - 프론트엔드나 관리자 페이지에서 사용
   - 실시간 등록 가능

3. **데이터 마이그레이션**: 방법 3 (SQL)
   - 기존 데이터 이전
   - 배치 작업

---

## 문제 해결

### 상품이 등록되지 않을 때

1. 서버가 실행 중인지 확인
   ```bash
   # 서버 실행 확인
   curl http://localhost:8080/api/v1/products
   ```

2. 데이터베이스 연결 확인
   ```bash
   # WSL에서 확인
   sudo -u postgres psql -d cmall_dd -c "SELECT COUNT(*) FROM cmall_dd;"
   ```

3. 이미지 경로 확인
   - 이미지 파일이 `public/images` 폴더에 있는지 확인
   - 경로는 `/images/파일명.jpg` 형식이어야 함

### 벡터 임베딩이 생성되지 않을 때

- 방법 1(스크립트)을 사용하면 자동으로 생성됩니다
- 방법 2(API)로 등록한 경우, 별도로 임베딩을 업데이트해야 합니다

