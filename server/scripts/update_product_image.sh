#!/bin/bash
# 상품 이미지 업데이트 스크립트 (WSL/Linux)

echo "=== 상품 이미지 업데이트 ==="
echo ""

# 가장 최근 등록된 상품의 이미지를 업데이트
sudo -u postgres psql -d cmall_dd -c "UPDATE cmall_dd SET image = '/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_1-30.jpg', updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM cmall_dd ORDER BY id DESC LIMIT 1) RETURNING id, name, image;"

echo ""
echo "완료!"

