# 예시 상품 등록 스크립트 (API 사용, PowerShell)
# 서버가 실행 중이어야 합니다

$API_URL = "http://localhost:8080/api/v1/products"

Write-Host "=== 예시 상품 등록 (API 사용) ===" -ForegroundColor Green
Write-Host ""

# 예시 상품 데이터
$product = @{
    name = "클래식 데님 자켓"
    price = 890000
    originalPrice = 1500000
    image = "/images/sample-product.jpg"
    category = "jackets"
    condition = "Excellent"
    description = "빈티지 스타일의 클래식 데님 자켓입니다. 내구성이 뛰어나고 다양한 스타일에 매치하기 좋습니다."
    size = "M"
    brand = "Levi's"
    color = "blue"
    material = "denim"
} | ConvertTo-Json

try {
    Write-Host "상품 등록 중..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $API_URL -Method POST -ContentType "application/json" -Body $product
    
    Write-Host ""
    Write-Host "✅ 상품 등록 완료!" -ForegroundColor Green
    Write-Host "상품 ID: $($response.id)" -ForegroundColor Cyan
    Write-Host "상품명: $($response.name)" -ForegroundColor Cyan
    Write-Host "가격: $($response.price)원" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "전체 상품 목록 확인:" -ForegroundColor Yellow
    Write-Host "Invoke-RestMethod -Uri http://localhost:8080/api/v1/products" -ForegroundColor Gray
} catch {
    Write-Host ""
    Write-Host "❌ 오류 발생:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "서버가 실행 중인지 확인하세요:" -ForegroundColor Yellow
    Write-Host "cd server" -ForegroundColor Gray
    Write-Host "go run main.go" -ForegroundColor Gray
}

