#!/bin/bash
# 이미지 제품 등록 및 임베딩 생성 스크립트 실행
# Linux/WSL용 셸 스크립트

echo "=== 이미지 제품 등록 및 임베딩 생성 ==="
echo ""

cd "$(dirname "$0")/.."
go run cmd/seed_images/main.go

