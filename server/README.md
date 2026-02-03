# CMall DD Backend API

Go 언어로 작성된 쇼핑몰 백엔드 API 서버입니다.

## 기술 스택

- **언어**: Go 1.21+
- **웹 프레임워크**: Gin
- **데이터베이스**: PostgreSQL with pgvector
- **ORM**: database/sql (표준 라이브러리)

## 설치 및 실행
sudo -u postgres psql -d cmall_dd -c "INSERT INTO cmall_dd (name, price, original_price, image, category, condition, description, size, brand, color, material) VALUES ('클래식 데님 자켓', 890000, 1500000, '/images/sample-product.jpg', 'jackets', 'Excellent', '빈티지 스타일의 클래식 데님 자켓입니다. 내구성이 뛰어나고 다양한 스타일에 매치하기 좋습니다.', 'M', 'Levi''s', 'blue', 'denim') RETURNING id, name, price;"
### 1. 의존성 설치

```bash
cd server
go mod download
```

### 2. 환경 변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

`.env` 파일을 편집하여 데이터베이스 연결 정보를 설정하세요:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres
PORT=8080
```

### 3. 데이터베이스 준비

WSL 환경에서 PostgreSQL이 실행 중이어야 합니다. pgvector 확장이 설치되어 있어야 합니다.

### 4. 서버 실행

```bash
go run main.go
```

또는 빌드 후 실행:

```bash
go build -o cmall_dd
./cmall_dd
```

서버는 기본적으로 `http://localhost:8080`에서 실행됩니다.

## API 엔드포인트

### 제품 관련

- `GET /api/v1/products` - 모든 제품 조회
- `GET /api/v1/products/:id` - 특정 제품 조회
- `POST /api/v1/products` - 새 제품 생성
- `PUT /api/v1/products/:id` - 제품 수정
- `DELETE /api/v1/products/:id` - 제품 삭제

### 장바구니 관련

- `GET /api/v1/cart?sessionId=xxx` - 장바구니 조회
- `POST /api/v1/cart` - 장바구니에 추가
- `PUT /api/v1/cart/:id` - 장바구니 항목 수정
- `DELETE /api/v1/cart/:id` - 장바구니 항목 삭제

## 데이터베이스 스키마

### cmall_dd 테이블 (제품)

- `id`: SERIAL PRIMARY KEY
- `name`: VARCHAR(255)
- `price`: INTEGER
- `original_price`: INTEGER (nullable)
- `image`: VARCHAR(500)
- `category`: VARCHAR(100)
- `condition`: VARCHAR(50)
- `description`: TEXT
- `size`: VARCHAR(50) (nullable)
- `brand`: VARCHAR(100) (nullable)
- `color`: VARCHAR(50) (nullable)
- `material`: VARCHAR(100) (nullable)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP
- `embedding`: vector(1536) (AI 검색용, 선택사항)

### cart 테이블 (장바구니)

- `id`: SERIAL PRIMARY KEY
- `product_id`: INTEGER (FK to cmall_dd)
- `quantity`: INTEGER
- `session_id`: VARCHAR(255)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

## 개발

### 프로젝트 구조

```
server/
├── main.go                 # 진입점
├── go.mod                  # Go 모듈 정의
├── .env                    # 환경 변수 (gitignore)
├── internal/
│   ├── database/          # 데이터베이스 연결 및 스키마
│   ├── handlers/          # API 핸들러
│   └── models/            # 데이터 모델
└── README.md
```

## 참고사항

- pgvector 확장은 AI 기반 검색 기능을 위해 사용할 수 있습니다.
- 현재는 기본적인 CRUD 기능만 구현되어 있습니다.
- 향후 AI 기능 추가 시 embedding 필드를 활용할 수 있습니다.

