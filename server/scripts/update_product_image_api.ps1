# 상품 이미지 업데이트 스크립트 (API 사용, PowerShell)
# 서버가 실행 중이어야 합니다

$API_URL = "http://localhost:8080/api/v1/products"

Write-Host "=== 상품 이미지 업데이트 (API 사용) ===" -ForegroundColor Green
Write-Host ""

# 1. 모든 상품 조회하여 최신 상품 찾기
try {
    Write-Host "상품 목록 조회 중..." -ForegroundColor Yellow
    $products = Invoke-RestMethod -Uri $API_URL -Method GET
    
    if ($products.Count -eq 0) {
        Write-Host "등록된 상품이 없습니다." -ForegroundColor Red
        exit
    }
    
    # 가장 최근 상품 찾기 (ID가 가장 큰 것)
    $latestProduct = $products | Sort-Object -Property id -Descending | Select-Object -First 1
    
    Write-Host "최신 상품 발견:" -ForegroundColor Cyan
    Write-Host "  ID: $($latestProduct.id)" -ForegroundColor Gray
    Write-Host "  이름: $($latestProduct.name)" -ForegroundColor Gray
    Write-Host "  현재 이미지: $($latestProduct.image)" -ForegroundColor Gray
    Write-Host ""
    
    # 2. 이미지 업데이트
    Write-Host "이미지 업데이트 중..." -ForegroundColor Yellow
    $updateData = @{
        image = "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_1-30.jpg"
    } | ConvertTo-Json
    
    $updatedProduct = Invoke-RestMethod -Uri "$API_URL/$($latestProduct.id)" -Method PUT -ContentType "application/json" -Body $updateData
    
    Write-Host ""
    Write-Host "✅ 이미지 업데이트 완료!" -ForegroundColor Green
    Write-Host "상품 ID: $($updatedProduct.id)" -ForegroundColor Cyan
    Write-Host "상품명: $($updatedProduct.name)" -ForegroundColor Cyan
    Write-Host "새 이미지 경로: $($updatedProduct.image)" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "❌ 오류 발생:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "서버가 실행 중인지 확인하세요:" -ForegroundColor Yellow
    Write-Host "cd server" -ForegroundColor Gray
    Write-Host "go run main.go" -ForegroundColor Gray
}

