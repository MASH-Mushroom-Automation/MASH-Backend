-- Database initialization script for MASH Backend
-- This script creates the database and initial extensions

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE mash_backend_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mash_backend_dev')\gexec

-- Connect to the database
\c mash_backend_dev;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create initial roles if needed
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'mash_app_user') THEN

      CREATE ROLE mash_app_user LOGIN PASSWORD 'mash_app_password';
   END IF;
END
$do$;

-- Grant privileges
GRANT CONNECT ON DATABASE mash_backend_dev TO mash_app_user;
GRANT USAGE ON SCHEMA public TO mash_app_user;
GRANT CREATE ON SCHEMA public TO mash_app_user;

-- Log completion
\echo 'Database initialization completed successfully!'