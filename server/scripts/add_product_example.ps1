# 상품 등록 예제 스크립트 (PowerShell)
# REST API를 사용하여 상품을 등록합니다

$API_URL = "http://localhost:8080/api/v1/products"

Write-Host "=== 상품 등록 예제 ===" -ForegroundColor Green
Write-Host ""

# 예제 1: 기본 상품 등록
Write-Host "1. 기본 상품 등록 중..." -ForegroundColor Yellow
$body1 = @{
    name = "테스트 상품"
    price = 500000
    originalPrice = 1000000
    image = "/images/test.jpg"
    category = "pants"
    condition = "Good"
    description = "테스트용 상품입니다"
    size = "M"
    brand = "테스트 브랜드"
    color = "blue"
    material = "cotton"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri $API_URL -Method POST -ContentType "application/json" -Body $body1
    Write-Host "등록 완료: $($response1.name) (ID: $($response1.id))" -ForegroundColor Green
} catch {
    Write-Host "오류: $_" -ForegroundColor Red
}

Write-Host ""

# 예제 2: 최소 필드만 사용
Write-Host "2. 최소 필드만 사용한 상품 등록 중..." -ForegroundColor Yellow
$body2 = @{
    name = "간단한 상품"
    price = 300000
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri $API_URL -Method POST -ContentType "application/json" -Body $body2
    Write-Host "등록 완료: $($response2.name) (ID: $($response2.id))" -ForegroundColor Green
} catch {
    Write-Host "오류: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "완료!" -ForegroundColor Green

