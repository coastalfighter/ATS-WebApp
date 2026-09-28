#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput

# Attempt migration with a timeout to prevent build hangs
timeout 30 python manage.py migrate 2>&1 || echo "WARNING: Migration skipped (DB may be unreachable)"
