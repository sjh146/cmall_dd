-- Create database cmall_dd
CREATE DATABASE cmall_dd;

-- Connect to the new database
\c cmall_dd

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

