#!/bin/bash
set -e

create_db_if_not_exists() {
    local DB="$1"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE "$DB"'
        WHERE NOT EXISTS (
            SELECT FROM pg_database WHERE datname = '$DB'
        )\gexec
EOSQL
    echo "Database '$DB' ready."
}

create_db_if_not_exists "auth_db"
create_db_if_not_exists "project_db"
create_db_if_not_exists "task_db"
create_db_if_not_exists "ai_db"
create_db_if_not_exists "realtime_db"
