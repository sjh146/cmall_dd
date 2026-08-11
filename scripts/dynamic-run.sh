#!/bin/bash
# Starts the cmall_dd Go backend against local PostgreSQL on 127.0.0.1:8081.
# Run from anywhere; working dir is the server/ dir so godotenv loads server/.env.
pkill -f cmall_dd_server 2>/dev/null
sleep 1
cd /workspace/cmall_dd/server
/usr/bin/go build -o /tmp/cmall_dd_server . 
nohup /tmp/cmall_dd_server > /tmp/cmall_server.log 2>&1 &
echo "PID: $!"; sleep 4; echo "log:"; tail -5 /tmp/cmall_server.log
curl -s -o /dev/null -w "GET /api/v1/products -> %{http_code}\n" http://127.0.0.1:8081/api/v1/products
