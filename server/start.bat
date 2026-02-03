@echo off
cd /d %~dp0
echo Starting Go backend server...
go run main.go
pause

