# 이미지 제품 등록 및 임베딩 생성 스크립트

이 스크립트는 `public/images` 폴더에 있는 이미지 파일들을 읽어서 데이터베이스에 제품으로 등록하고, 로컬에서 벡터 임베딩을 생성합니다.

## 필요 사항

1. **데이터베이스 연결**: `.env` 파일에 데이터베이스 정보 설정 필요
2. **이미지 파일**: `public/images` 폴더에 이미지 파일이 있어야 함
3. **외부 API 불필요**: 모든 임베딩은 로컬에서 생성됩니다

## 환경 변수 설정

`server/.env` 파일에 다음을 추가하세요:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cmall_dd
IMAGES_DIR=../../public/images  # 선택사항, 기본값 사용 가능
```

## 실행 방법

### 방법 1: 직접 실행

```bash
cd server/cmd/seed_images
go run main.go
```

### 방법 2: 프로젝트 루트에서 실행

```bash
cd server
go run cmd/seed_images/main.go
```

## 동작 방식

1. `public/images` 폴더에서 `.jpg` 파일을 스캔
2. 각 이미지 파일명에서 제품 정보를 매핑
3. 제품 정보(이름, 설명 등)를 기반으로 로컬에서 벡터 임베딩 생성
   - 해시 기반 벡터 생성 방식 사용
   - 단어 빈도 및 텍스트 해시를 활용하여 1536차원 벡터 생성
   - L2 정규화 적용
4. 생성된 벡터 임베딩(1536차원)을 데이터베이스에 저장

## 제품 매핑

현재 다음 이미지들이 매핑되어 있습니다:

- `frame_1-30.jpg` → Celana Jeans Vintage Levi's 501
- `frame_2-00.jpg` → Kaos Band Vintage
- `frame_2-30.jpg` → Blazer Wol
- `frame_3-00.jpg` → Dress Musim Panas Motif Bunga
- `frame_3-20.jpg` → Celana Chino Khaki
- `frame_4-00.jpg` → Sweater Oversized

## 주의사항

- 외부 API를 사용하지 않으므로 비용이 발생하지 않습니다
- 이미 존재하는 제품의 경우 임베딩만 업데이트됩니다
- 벡터 차원은 1536차원입니다
- 로컬 해시 기반 임베딩 생성 방식을 사용하므로, 동일한 텍스트는 항상 동일한 벡터를 생성합니다
- 의미 기반 유사도 검색에는 제한이 있을 수 있지만, 기본적인 벡터 검색은 가능합니다

