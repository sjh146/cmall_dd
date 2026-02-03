#!/bin/bash
# 예시 상품 등록 스크립트 (WSL/Linux)

echo "=== 예시 상품 등록 ==="
echo ""

# 데이터베이스에 상품 추가
sudo -u postgres psql -d cmall_dd -f "$(dirname "$0")/add_sample_product.sql"

echo ""
echo "완료! 등록된 상품을 확인하려면:"
echo "sudo -u postgres psql -d cmall_dd -c \"SELECT id, name, price FROM cmall_dd;\""

