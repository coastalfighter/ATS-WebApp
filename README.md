# ATS - Applicant Tracking System

Internal ATS for recruitment/RPO business. Used by Admin, Subadmins, and Recruiters.

## Tech Stack

- **Backend**: Django 5.1, Django REST Framework, PostgreSQL
- **Frontend**: React 18 (Vite), Bootstrap 5, Axios
- **Auth**: JWT (SimpleJWT)
- **Integrations**: Google Calendar API, Zoom API, Google Workspace SMTP

---

## Project Structure

```
ATS-WebApp/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── ats_project/          # Django project settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── accounts/             # User auth, management
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── permissions.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── management/commands/create_admin.py
│   ├── candidates/           # Candidate CRUD, upload, workflow
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── filters.py
│   │   ├── constants.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── services/
│   │   │   ├── assignment.py
│   │   │   ├── duplicate_detection.py
│   │   │   ├── import_handler.py
│   │   │   └── status_transition.py
│   │   └── management/commands/seed_data.py
│   ├── interviews/           # Interview scheduling, Zoom, Calendar, Email
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── services/
│   │       ├── zoom_service.py
│   │       ├── calendar_service.py
│   │       └── email_service.py
│   ├── dashboard/            # Dashboard endpoints
│   │   ├── views.py
│   │   └── urls.py
│   ├── reports/              # Reporting endpoints
│   │   ├── views.py
│   │   └── urls.py
│   └── core/                 # Health check, misc
│       ├── views.py
│       └── urls.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── context/AuthContext.jsx
│       ├── services/api.js
│       ├── utils/statusHelpers.js
│       ├── components/
│       │   ├── common/       # LoadingSpinner, AlertMessage, Pagination
│       │   ├── layout/       # Sidebar, Topbar, MainLayout
│       │   └── auth/         # ProtectedRoute
│       └── pages/
│           ├── LoginPage.jsx
│           ├── DashboardPage.jsx
│           ├── FreshCandidatesPage.jsx
│           ├── PipelineCandidatesPage.jsx
│           ├── CandidateDetailPage.jsx
│           ├── UploadCandidatesPage.jsx
│           ├── BatchHistoryPage.jsx
│           ├── InterviewsPage.jsx
│           ├── ReportsPage.jsx
│           ├── UserManagementPage.jsx
│           ├── DuplicateReviewPage.jsx
│           ├── ProfilePage.jsx
│           └── ChangePasswordPage.jsx
└── README.md
```

---

## API Endpoint Summary

### Auth (`/api/auth/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Login, returns JWT tokens + user |
| POST | `/api/auth/logout/` | Logout, blacklists refresh token |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET/PATCH | `/api/auth/profile/` | Get/update own profile |
| POST | `/api/auth/change-password/` | Change own password |
| GET | `/api/auth/users/` | List users (admin/subadmin) |
| POST | `/api/auth/users/` | Create user (admin/subadmin) |
| GET | `/api/auth/users/{id}/` | Get user detail |
| PATCH | `/api/auth/users/{id}/` | Update user |
| POST | `/api/auth/users/{id}/toggle_active/` | Activate/deactivate user |
| POST | `/api/auth/users/reset_password/` | Admin reset user password |
| GET | `/api/auth/users/recruiters/` | List recruiters |

### Candidates (`/api/candidates/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/candidates/list/` | List candidates (paginated, filterable) |
| POST | `/api/candidates/list/` | Create single candidate |
| GET | `/api/candidates/list/{id}/` | Candidate detail |
| PATCH | `/api/candidates/list/{id}/` | Update candidate |
| POST | `/api/candidates/list/{id}/update_status/` | Update candidate status |
| POST | `/api/candidates/list/{id}/reassign/` | Reassign to recruiter |
| POST | `/api/candidates/list/{id}/add_note/` | Add note |
| GET | `/api/candidates/list/{id}/notes/` | Get notes |
| GET | `/api/candidates/list/{id}/activity/` | Get activity log |
| GET | `/api/candidates/list/{id}/assignment_history/` | Assignment history |
| POST | `/api/candidates/list/{id}/set_follow_up/` | Set follow-up date |
| GET | `/api/candidates/list/fresh/` | List fresh candidates |
| GET | `/api/candidates/list/pipeline/` | List pipeline candidates |
| GET | `/api/candidates/list/duplicates/` | List duplicates |
| GET | `/api/candidates/list/status_options/` | Get status choices + transitions |
| POST | `/api/candidates/upload/` | Upload CSV/XLSX file |
| POST | `/api/candidates/upload/preview/` | Preview upload file |
| GET | `/api/candidates/batches/` | List upload batches |
| GET | `/api/candidates/batches/{id}/` | Batch detail with errors |
| GET | `/api/candidates/activity-logs/` | Global activity logs |
| POST | `/api/candidates/settings/reset_round_robin/` | Reset round-robin pointer |

### Interviews (`/api/interviews/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/interviews/list/` | List interviews |
| POST | `/api/interviews/list/` | Schedule interview (creates Zoom + Calendar) |
| GET | `/api/interviews/list/{id}/` | Interview detail |
| PATCH | `/api/interviews/list/{id}/` | Update/reschedule interview |
| POST | `/api/interviews/list/{id}/cancel/` | Cancel interview |
| POST | `/api/interviews/list/{id}/send_reminder/` | Send reminder email |
| GET | `/api/interviews/emails/` | Email send logs |

### Dashboard (`/api/dashboard/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/recruiter/` | Recruiter dashboard stats |
| GET | `/api/dashboard/admin/` | Admin dashboard stats |

### Reports (`/api/reports/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/recruiter-wise/` | Recruiter-wise counts |
| GET | `/api/reports/contacted-vs-uncontacted/` | Contact ratios |
| GET | `/api/reports/fresh-to-pipeline/` | Conversion rate |
| GET | `/api/reports/negative-breakdown/` | Negative outcomes |
| GET | `/api/reports/follow-up-pending/` | Pending follow-ups |
| GET | `/api/reports/pipeline-stages/` | Pipeline stage counts |
| GET | `/api/reports/upload-batches/` | Upload batch summary |
| GET | `/api/reports/duplicates/` | Duplicate report |
| GET | `/api/reports/daily-trends/?days=30` | Daily candidate trends |
| GET | `/api/reports/recruiter-productivity/?days=7` | Recruiter productivity |
| GET | `/api/reports/export-csv/` | Export candidates as CSV |

### Core (`/api/core/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/core/health/` | Health check |

---

## Sample API Requests

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123456"}'
```

### List Fresh Candidates
```bash
curl http://localhost:8000/api/candidates/list/?bucket=fresh \
  -H "Authorization: Bearer <access_token>"
```

### Upload Candidates
```bash
curl -X POST http://localhost:8000/api/candidates/upload/ \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@candidates.csv"
```

### Update Candidate Status
```bash
curl -X POST http://localhost:8000/api/candidates/list/1/update_status/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "contacted", "remarks": "Called and spoke"}'
```

### Schedule Interview
```bash
curl -X POST http://localhost:8000/api/interviews/list/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate": 1,
    "title": "Technical Screening",
    "interview_date": "2026-09-10",
    "start_time": "10:00:00",
    "end_time": "10:30:00",
    "timezone": "Asia/Kolkata",
    "attendees": "hiring.manager@company.com",
    "description": "First round screening"
  }'
```

---

## Local Development Setup Guide

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### Step 1: Clone and Setup Backend

```bash
cd ATS-WebApp/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env
# Edit .env with your database credentials and secrets
```

### Step 2: Setup PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE ats_db;
CREATE USER ats_user WITH PASSWORD 'your-secure-password';
ALTER ROLE ats_user SET client_encoding TO 'utf8';
ALTER ROLE ats_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE ats_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE ats_db TO ats_user;
ALTER DATABASE ats_db OWNER TO ats_user;
\q
```

### Step 3: Configure .env

Edit `backend/.env`:
```
DJANGO_SECRET_KEY=generate-a-random-50-char-string-here
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=ats_db
DB_USER=ats_user
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

To generate a secret key:
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Step 4: Add dotenv loading to manage.py

Add to the top of `manage.py` after the imports:
```python
from dotenv import load_dotenv
load_dotenv()
```

Or alternatively, set environment variables in your shell before running Django.

### Step 5: Create logs directory and run migrations

```bash
mkdir -p logs
python manage.py makemigrations accounts candidates interviews
python manage.py migrate
```

### Step 6: Create Admin User

```bash
python manage.py create_admin --username admin --email admin@yourcompany.com --password 'YourSecureAdminPassword!'
```

### Step 7: Seed Sample Data

```bash
python manage.py seed_data
```

### Step 8: Run Backend Server

```bash
python manage.py runserver
```

Backend runs on http://localhost:8000

### Step 9: Setup Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

### Step 10: Login

Open http://localhost:5173 in browser.
- **Admin**: admin / YourSecureAdminPassword!
- **Subadmin**: subadmin1 / Subadmin@123
- **Recruiter**: recruiter1 / Recruiter@123

---

## Ubuntu VPS Deployment Guide (Hostinger)

### Step 1: Initial Server Setup

```bash
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3 python3-pip python3-venv python3-dev \
  postgresql postgresql-contrib nginx curl git \
  libpq-dev build-essential

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Create app user
adduser --disabled-password atsapp
usermod -aG sudo atsapp
```

### Step 2: PostgreSQL Setup

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE ats_db;
CREATE USER ats_user WITH PASSWORD 'strong-production-password-here';
ALTER ROLE ats_user SET client_encoding TO 'utf8';
ALTER ROLE ats_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE ats_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE ats_db TO ats_user;
ALTER DATABASE ats_db OWNER TO ats_user;
\q
```

### Step 3: Deploy Application Code

```bash
su - atsapp
mkdir -p /home/atsapp/ats
cd /home/atsapp/ats

# Copy or clone your project files here
# git clone <your-repo-url> .

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env (edit with production values)
cp .env.example .env
nano .env
```

Production `.env` values:
```
DJANGO_SECRET_KEY=your-very-long-random-production-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DB_NAME=ats_db
DB_USER=ats_user
DB_PASSWORD=strong-production-password-here
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-workspace-email@yourdomain.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-workspace-email@yourdomain.com
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
GOOGLE_CALENDAR_CREDENTIALS_FILE=/home/atsapp/ats/credentials.json
GOOGLE_CALENDAR_TOKEN_FILE=/home/atsapp/ats/token.json
DUPLICATE_DETECTION_STRATEGY=email
```

### Step 4: Run Migrations and Create Admin

```bash
source venv/bin/activate
mkdir -p logs

python manage.py makemigrations accounts candidates interviews
python manage.py migrate
python manage.py create_admin --username admin --email admin@yourdomain.com --password 'ProductionAdminPassword!'
python manage.py collectstatic --noinput
```

### Step 5: Build Frontend

```bash
cd /home/atsapp/ats/frontend
npm install
```

Create `/home/atsapp/ats/frontend/.env`:
```
VITE_API_URL=https://yourdomain.com/api
```

```bash
npm run build

# Copy build to Django static
mkdir -p /home/atsapp/ats/backend/static
cp -r dist/* /home/atsapp/ats/backend/static/
```

### Step 6: Gunicorn Setup

Create systemd service file:

```bash
sudo nano /etc/systemd/system/ats.service
```

```ini
[Unit]
Description=ATS Gunicorn Daemon
After=network.target

[Service]
User=atsapp
Group=atsapp
WorkingDirectory=/home/atsapp/ats/backend
EnvironmentFile=/home/atsapp/ats/backend/.env
ExecStart=/home/atsapp/ats/backend/venv/bin/gunicorn \
    --workers 3 \
    --bind unix:/home/atsapp/ats/backend/ats.sock \
    --timeout 120 \
    ats_project.wsgi:application

Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start ats
sudo systemctl enable ats
sudo systemctl status ats
```

### Step 7: Nginx Setup

```bash
sudo nano /etc/nginx/sites-available/ats
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://unix:/home/atsapp/ats/backend/ats.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://unix:/home/atsapp/ats/backend/ats.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /home/atsapp/ats/backend/staticfiles/;
    }

    location /media/ {
        alias /home/atsapp/ats/backend/media/;
    }

    location / {
        root /home/atsapp/ats/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ats /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 8: HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot auto-renews. Verify:
```bash
sudo certbot renew --dry-run
```

### Step 9: Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google Calendar API"
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Application type: Desktop application
6. Download the credentials JSON file
7. Save it as `/home/atsapp/ats/credentials.json` on your server
8. Run the initial auth flow once on the server:

```bash
cd /home/atsapp/ats/backend
source venv/bin/activate
python -c "
from interviews.services.calendar_service import GoogleCalendarService
service = GoogleCalendarService._get_service()
print('Calendar auth successful')
"
```

This opens a browser for OAuth consent (use SSH tunnel or do it locally first, then copy `token.json` to server).

9. Set in `.env`:
```
GOOGLE_CALENDAR_CREDENTIALS_FILE=/home/atsapp/ats/credentials.json
GOOGLE_CALENDAR_TOKEN_FILE=/home/atsapp/ats/token.json
```

---

## Zoom API Setup

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click "Develop" > "Build App"
3. Choose "Server-to-Server OAuth"
4. Fill in app details
5. Copy Account ID, Client ID, Client Secret
6. Add required scopes: `meeting:write:admin`, `meeting:read:admin`
7. Activate the app
8. Set in `.env`:
```
ZOOM_ACCOUNT_ID=your-account-id
ZOOM_CLIENT_ID=your-client-id
ZOOM_CLIENT_SECRET=your-client-secret
```

---

## Google Workspace Email Setup

1. In Google Admin, enable "Less secure app access" OR better: use App Passwords
2. Go to your Google Account > Security > 2-Step Verification (enable it)
3. Go to App Passwords > Generate for "Mail" on "Other (Custom name)"
4. Copy the 16-char app password
5. Set in `.env`:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@yourdomain.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx
DEFAULT_FROM_EMAIL=your-email@yourdomain.com
```

---

## Creating Users

### First Admin User
```bash
cd /home/atsapp/ats/backend
source venv/bin/activate
python manage.py create_admin --username admin --email admin@yourdomain.com --password 'SecurePassword!'
```

### Creating Subadmins and Recruiters

Login as Admin in the web UI > User Management > Create User.

Or via API:
```bash
curl -X POST http://localhost:8000/api/auth/users/ \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "recruiter1",
    "email": "recruiter1@company.com",
    "first_name": "Alice",
    "last_name": "Johnson",
    "role": "recruiter",
    "password": "Recruiter@123",
    "password_confirm": "Recruiter@123"
  }'
```

Or via Django Admin at `/admin/`.

---

## Running Migrations

```bash
cd /home/atsapp/ats/backend
source venv/bin/activate
python manage.py makemigrations
python manage.py migrate
```

---

## Seeding Sample Data

```bash
python manage.py seed_data
```

Creates: 1 subadmin, 3 recruiters, 10 sample candidates.

---

## Test Workflow Checklist

- [ ] Login as admin, subadmin, recruiter - each role works
- [ ] Admin can create/deactivate users
- [ ] Upload CSV with candidates - preview works, import works
- [ ] Duplicates are detected and flagged
- [ ] Fresh candidates appear in Fresh list
- [ ] Round-robin assignment distributes evenly
- [ ] Recruiter sees only their assigned candidates
- [ ] Status update works (fresh statuses)
- [ ] "Interested" status auto-moves to Pipeline
- [ ] Pipeline transitions follow valid rules
- [ ] Admin override bypasses transition rules
- [ ] Notes can be added and viewed
- [ ] Follow-up date can be set
- [ ] Candidate reassignment works (admin/subadmin)
- [ ] Interview scheduling creates Zoom + Calendar
- [ ] Interview cancellation works
- [ ] Reminder emails send
- [ ] Dashboard shows correct stats
- [ ] Reports load with accurate data
- [ ] CSV export downloads
- [ ] Activity log shows all actions
- [ ] Password change works
- [ ] Profile update works
- [ ] Logout works and blacklists token
- [ ] Protected routes redirect unauthenticated users

---

## Common Troubleshooting

### "CORS error" in browser
Check `CORS_ALLOWED_ORIGINS` in `.env` matches your frontend URL exactly.

### "502 Bad Gateway" from Nginx
```bash
sudo systemctl status ats
sudo journalctl -u ats -n 50
```
Check Gunicorn is running and the socket file exists.

### Database connection errors
Verify PostgreSQL is running and credentials match `.env`:
```bash
sudo systemctl status postgresql
psql -U ats_user -d ats_db -h localhost
```

### Migration errors
```bash
python manage.py showmigrations
python manage.py makemigrations accounts candidates interviews
python manage.py migrate
```

### Static files not loading
```bash
python manage.py collectstatic --noinput
# Check Nginx static file path matches settings
```

### Zoom/Calendar not working
Check `.env` credentials. Look at logs:
```bash
tail -f /home/atsapp/ats/backend/logs/ats.log
```

### Permission denied on socket
```bash
sudo chown atsapp:www-data /home/atsapp/ats/backend/ats.sock
# Or ensure Nginx user can access the socket directory
sudo chmod 755 /home/atsapp /home/atsapp/ats /home/atsapp/ats/backend
```

---

## Post-Deployment Checklist

- [ ] `DJANGO_DEBUG=False` in production
- [ ] `DJANGO_SECRET_KEY` is unique and random
- [ ] PostgreSQL password is strong
- [ ] HTTPS is configured (Let's Encrypt)
- [ ] Firewall is enabled (UFW)
- [ ] CORS origins match production domain
- [ ] Email sending works (test with interview scheduling)
- [ ] Zoom integration works
- [ ] Google Calendar integration works
- [ ] Static files serve correctly
- [ ] Admin panel accessible at /admin/
- [ ] All user roles can login
- [ ] File uploads work (check max size in Nginx)
- [ ] Logs directory is writable
- [ ] Gunicorn service starts on boot
- [ ] Nginx service starts on boot
- [ ] Database backups configured (pg_dump cron)
- [ ] Application log rotation configured

---

## Database Backup (Recommended Cron)

```bash
# Add to crontab (crontab -e)
0 2 * * * pg_dump -U ats_user -h localhost ats_db | gzip > /home/atsapp/backups/ats_$(date +\%Y\%m\%d).sql.gz
```

```bash
mkdir -p /home/atsapp/backups
```

---

## Updating the Application

```bash
cd /home/atsapp/ats

# Pull latest code
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Frontend
cd ../frontend
npm install
npm run build
cp -r dist/* ../backend/static/

# Restart
sudo systemctl restart ats
sudo systemctl restart nginx
```
