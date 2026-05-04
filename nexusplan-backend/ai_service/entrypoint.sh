#!/bin/sh
set -e

echo "[ai_service] Running makemigrations..."
python manage.py makemigrations --no-input

echo "[ai_service] Running migrate..."
python manage.py migrate --no-input

echo "[ai_service] Starting server..."
exec "$@"
