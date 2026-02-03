# 환경 변수 설정 가이드

## .env 파일 생성

`server` 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=postgres

# Server Configuration
PORT=8080

# CORS Origins (comma separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## WSL 환경에서 PostgreSQL 연결

WSL에서 실행 중인 PostgreSQL에 연결하려면:

1. **WSL IP 주소 확인**:
   ```bash
   wsl hostname -I
   ```

2. **DB_HOST 설정**:
   - WSL IP 주소를 사용하거나
   - `localhost` 사용 (Windows에서 WSL로 포트 포워딩이 설정된 경우)

3. **포트 확인**:
   - 기본 PostgreSQL 포트는 `5432`입니다.
   - WSL에서 포트가 다르게 설정된 경우 해당 포트를 사용하세요.

## 데이터베이스 생성 및 초기화

### 1단계: 데이터베이스 생성

WSL에서 다음 명령어를 실행하세요:

```bash
# 방법 1: 직접 SQL 명령어 실행
sudo -u postgres psql -c "CREATE DATABASE cmall_dd;"

# 방법 2: 스크립트 사용
sudo -u postgres psql -f /mnt/e/Users/dduckbeagy/cmall_dd/server/scripts/create_database.sql
```

### 2단계: pgvector 확장 활성화

```bash
sudo -u postgres psql -d cmall_dd -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3단계: 테이블 생성

```bash
sudo -u postgres psql -d cmall_dd -f /mnt/e/Users/dduckbeagy/cmall_dd/server/scripts/init_db.sql
```

또는 Windows에서:
```bash
wsl sudo -u postgres psql -d cmall_dd -f /mnt/e/Users/dduckbeagy/cmall_dd/server/scripts/init_db.sql
```

### 4단계: 샘플 데이터 삽입 (선택사항)

```bash
sudo -u postgres psql -d cmall_dd -f /mnt/e/Users/dduckbeagy/cmall_dd/server/scripts/seed_data.sql
```

### 방법 2: Go 서버 실행 시 자동 생성

`.env` 파일에서 `DB_NAME=cmall_dd`로 설정하고 Go 서버를 실행하면 테이블이 자동으로 생성됩니다.

## 환경 변수 설정

`.env` 파일에서 데이터베이스 이름을 `cmall_dd`로 변경하세요:

```env
DB_NAME=cmall_dd
```

## 연결 테스트

```bash
sudo -u postgres psql -d cmall_dd -c "SELECT COUNT(*) FROM cmall_dd;"
```

