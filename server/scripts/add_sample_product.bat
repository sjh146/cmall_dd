@echo off
REM 예시 상품 등록 스크립트 (Windows)

echo === 예시 상품 등록 ===
echo.

REM WSL을 통해 PostgreSQL에 접속하여 상품 추가
wsl sudo -u postgres psql -d cmall_dd -f /mnt/e/Users/dduckbeagy/cmall_dd/server/scripts/add_sample_product.sql

echo.
echo 완료! 등록된 상품을 확인하려면:
echo wsl sudo -u postgres psql -d cmall_dd -c "SELECT id, name, price FROM cmall_dd;"
pause

