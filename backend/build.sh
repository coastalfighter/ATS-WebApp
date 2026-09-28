#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput

# Migration may fail if DB is temporarily unreachable
python manage.py migrate 2>&1 || echo "WARNING: Migration failed, continuing deployment"
