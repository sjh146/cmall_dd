#!/bin/bash
# 상품 등록 예제 스크립트
# REST API를 사용하여 상품을 등록합니다

API_URL="http://localhost:8080/api/v1/products"

echo "=== 상품 등록 예제 ==="
echo ""

# 예제 1: 기본 상품 등록
echo "1. 기본 상품 등록 중..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 상품",
    "price": 500000,
    "originalPrice": 1000000,
    "image": "/images/test.jpg",
    "category": "pants",
    "condition": "Good",
    "description": "테스트용 상품입니다",
    "size": "M",
    "brand": "테스트 브랜드",
    "color": "blue",
    "material": "cotton"
  }'

echo ""
echo ""

# 예제 2: 최소 필드만 사용
echo "2. 최소 필드만 사용한 상품 등록 중..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "간단한 상품",
    "price": 300000
  }'

echo ""
echo ""
echo "완료!"

