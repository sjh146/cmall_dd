@echo off
REM 이미지 제품 등록 및 임베딩 생성 스크립트 실행
REM Windows용 배치 파일

echo === 이미지 제품 등록 및 임베딩 생성 ===
echo.

cd /d %~dp0..
go run cmd/seed_images/main.go

pause

