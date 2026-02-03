#!/bin/bash

# Create database cmall_dd
sudo -u postgres psql -c "CREATE DATABASE cmall_dd;"

# Enable pgvector extension
sudo -u postgres psql -d cmall_dd -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Database cmall_dd created successfully!"

