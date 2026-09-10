# ATS V2 — Architecture Recommendation

---

## 1. Executive Recommendation

The current ATS system provides a solid foundation with functional candidate management, recruiter workflows, interview scheduling, and admin tools. However, the master plan describes a **complete hiring lifecycle** — from CSV upload through Round 2 interviews, observation, hiring, and FastGem handoff — and the current system covers only approximately **40%** of that lifecycle.

**Recommendation:** Evolve the existing codebase incrementally across **6 milestones** rather than a full rewrite. The Django 5.1 + React 18 stack is appropriate. The critical gaps are:

1. **Missing Entities:** HiringManager, Trainer, Booking (linking candidates to interview slots), Round2/Observation, FastGem upload
2. **Broken Linkage:** InterviewSlot exists but is disconnected from Interview — no booking flow bridges them
3. **No Background Processing:** All operations (Zoom, Calendar, Email) are synchronous — one failure blocks the entire request
4. **No Notification System:** No in-app notifications, no bell icon, no real-time updates
5. **No RingCentral Integration:** Settings stored but zero integration code
6. **Security Gaps:** Zoom credentials in plaintext, Google Calendar uses local auth flow, no field-level encryption
7. **Missing Workflow Stages:** No Round 2, no Observation, no Training, no FastGem upload

**Risk if not addressed:** The system cannot manage candidates past Round 1, cannot assign them to trainers, cannot track hiring decisions, and cannot hand off to client systems — making it an incomplete ATS that stops at the interview stage.

---

## 2. Technology Stack

| Layer | Current | V2 Recommendation | Change? |
|---|---|---|---|
| **Backend Framework** | Django 5.1.4 + DRF 3.15 | Django 5.1 + DRF 3.15 | No change |
| **Frontend Framework** | React 18 + Vite 6 | React 18 + Vite 6 | No change |
| **Database** | PostgreSQL 15+ | PostgreSQL 15+ | No change |
| **Auth** | SimpleJWT (access + refresh) | SimpleJWT (access + refresh) | No change |
| **CSS** | Bootstrap 5 + Bootstrap Icons + custom | Same | No change |
| **Background Jobs** | None (synchronous) | **Celery + Redis** | **New** |
| **Cache** | None | **Redis** (shared with Celery broker) | **New** |
| **Real-time** | None | **Django Channels + WebSocket** | **New** |
| **Task Scheduler** | None | **Celery Beat** | **New** |
| **Secrets Management** | Plaintext in DB / env vars | **django-encrypted-model-fields** or **Fernet symmetric encryption** | **New** |
| **File Storage** | Local filesystem | Local filesystem (migrate to S3 later) | No change |
| **Email** | Synchronous SMTP | **Celery async tasks + Django template engine** | **Upgrade** |
| **Telephony** | RingCentral (settings only) | **RingCentral SDK integration** | **New** |
| **Video** | Zoom Server-to-Server OAuth | Same (add per-account encryption) | **Upgrade** |
| **Calendar** | Google Calendar (InstalledAppFlow) | **Google Calendar (Service Account)** | **Upgrade** |
| **State Charts** | If/else validation | **django-fsm** or manual state machine module | **Evaluate** |

---

## 3. Why This Stack

**Django + DRF stays** because:
- The backend is already 4,000+ lines of working, tested code
- DRF viewsets, serializers, and filters are well-structured
- Django's migration system handles schema evolution cleanly
- The team is already productive with it

**React 18 + Vite stays** because:
- 22 pages are fully implemented with consistent patterns
- Vite HMR provides fast development cycles
- Bootstrap 5 integration is clean and mobile-responsive

**Celery + Redis added** because:
- Zoom meeting creation, Google Calendar events, and email dispatch MUST be async — synchronous calls block the request for 2-5 seconds each, and any failure returns a 500 to the user
- Celery Beat handles scheduled tasks: follow-up reminders, interview reminders, daily digest emails, slot availability checks
- Redis serves double duty as Celery broker and application cache

**Django Channels added** because:
- The master plan requires a notification bell with real-time updates
- Recruiters need to see when candidates are booked/reassigned without polling
- Admin needs real-time dashboard metrics

**Google Calendar Service Account** replaces InstalledAppFlow because:
- InstalledAppFlow opens a local browser for OAuth — impossible on a production server
- Service Account with domain-wide delegation works headlessly

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React 18 SPA (Vite)                     │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Candidate│ │ Booking  │ │Interview │ │  Admin/Reports   ││
│  │ Module   │ │ Module   │ │ Module   │ │  Module          ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────────────┘│
│       │             │            │             │             │
│  ┌────┴─────────────┴────────────┴─────────────┴──────────┐ │
│  │              WebSocket (Notifications)                  │ │
│  └─────────────────────┬──────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────┘
                         │ REST API + WS
┌────────────────────────┼────────────────────────────────────┐
│                   Nginx / Reverse Proxy                      │
│              /api/* → Django   /ws/* → Channels              │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│               Django 5.1 + DRF Backend                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ accounts │ │candidates│ │interviews│ │   reports      │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├───────────────┤  │
│  │  core    │ │dashboard │ │bookings  │ │ notifications │  │
│  │  (new)   │ │          │ │  (new)   │ │   (new)       │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│                         │                                    │
│  ┌──────────────────────┼──────────────────────────────────┐│
│  │              Service Layer                               ││
│  │  ZoomService │ CalendarService │ EmailService            ││
│  │  RingCentralService (new) │ NotificationService (new)   ││
│  └──────────────────────┼──────────────────────────────────┘│
└────────────────────────┼────────────────────────────────────┘
                         │
        ┌────────────────┼──────────────────┐
        │                │                  │
   ┌────┴────┐     ┌─────┴─────┐     ┌─────┴─────┐
   │PostgreSQL│     │   Redis   │     │  Celery   │
   │  (data)  │     │(broker +  │     │ Workers   │
   │          │     │  cache)   │     │ + Beat    │
   └──────────┘     └───────────┘     └───────────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                         ┌────┴───┐  ┌─────┴────┐ ┌────┴────┐
                         │  Zoom  │  │ Google   │ │RingCentral│
                         │  API   │  │ Calendar │ │   API     │
                         └────────┘  └──────────┘ └───────────┘
```

---

## 5. Module Architecture

### Existing Modules (to be enhanced)

| Module | Current State | V2 Changes |
|---|---|---|
| **accounts** | User model with admin/subadmin/recruiter roles, JWT auth, profile CRUD | Add `hiring_manager` and `trainer` role choices; add forgot-password flow |
| **candidates** | Full CRUD, upload, status machine, notes, activity log, assignment, duplicates | Add bulk actions, soft delete, KPI-driven daily target tracking |
| **interviews** | Interview CRUD, Zoom + Calendar + Email on create, slots, locations, call logs | Add Round 2 + Observation types; link InterviewSlot → Booking → Interview chain |
| **reports** | 10 report endpoints + CSV export | Add recruiter daily productivity, KPI attainment, batch source analysis |
| **dashboard** | Recruiter + admin views | Add notification widget, KPI cards, daily target vs actual |
| **core** | Audit logging middleware | Expand with shared utilities, pagination, exception handling |

### New Modules

| Module | Purpose |
|---|---|
| **bookings** | Bridge InterviewSlot → Candidate assignment. Booking model tracks which candidate is booked into which slot, booking status, and triggers Interview creation on confirmation |
| **notifications** | In-app notification model, WebSocket delivery via Django Channels, bell icon API, mark-as-read, notification preferences |
| **integrations** | Consolidated home for RingCentral, Zoom, Google Calendar service classes + encrypted credential storage |

---

## 6. Database Architecture

### Current Schema: 14 Models

```
accounts.User (3 roles)
candidates.Candidate, CandidateNote, CandidateActivityLog,
  RecruiterAssignmentHistory, UploadBatch, ImportRowError, AppSetting
interviews.Interview, InterviewSlot, ZoomAccount, EmailLog, Location, CallLog
```

### V2 Schema: ~22 Models (8 new + enhancements)

**New Models:**

```
bookings.Booking
  - candidate FK → Candidate
  - interview_slot FK → InterviewSlot
  - booked_by FK → User (recruiter)
  - status: pending | confirmed | cancelled | no_show
  - round: round_1 | round_2
  - interview FK → Interview (created on confirmation, nullable)
  - created_at, updated_at

bookings.BookingActivityLog
  - booking FK
  - action, old_value, new_value, performed_by, created_at

notifications.Notification
  - recipient FK → User
  - title, message, category (info|warning|action)
  - link (optional deep-link path)
  - is_read: bool
  - created_at

notifications.NotificationPreference
  - user FK → User (OneToOne)
  - email_on_booking: bool
  - email_on_interview: bool
  - email_on_assignment: bool
  - push_enabled: bool

interviews.InterviewFeedback (new)
  - interview FK
  - submitted_by FK → User
  - round: round_1 | round_2
  - rating: 1-5
  - strengths, weaknesses, recommendation (hire|reject|next_round)
  - created_at

interviews.ObservationSheet (new)
  - interview FK (Round 2)
  - trainer FK → User
  - observation_date
  - performance_score
  - notes
  - recommendation: proceed | extend_training | reject

candidates.FastGemUpload (new, or as extension)
  - candidate FK
  - uploaded_by FK → User
  - upload_data: JSONField
  - status: pending | uploaded | failed
  - external_reference_id
  - created_at

integrations.IntegrationCredential (new)
  - provider: zoom | google | ringcentral
  - account_label
  - encrypted_credentials: TextField (Fernet-encrypted JSON)
  - is_active: bool
  - last_verified_at
  - created_at
```

**Model Enhancements:**

| Model | Enhancement |
|---|---|
| `User` | Add `Role.HIRING_MANAGER` and `Role.TRAINER` choices; add `daily_target` field |
| `Candidate` | Add `soft_deleted` BooleanField + manager; add `date_of_birth`, `experience_years`, `current_company`, `current_designation` fields (per master plan) |
| `Interview` | Add `round` field (round_1, round_2); FK to `InterviewSlot`; FK to `Booking` |
| `InterviewSlot` | Add `round_type` (round_1, round_2); add `interview_type` (screening, technical, observation) |
| `ZoomAccount` | Migrate credentials to `IntegrationCredential`; keep FK reference |
| `AppSetting` | Add `category` field for grouping (general, kpi, integration, email) |

### Key Relationships

```
UploadBatch → Candidate(s)
Candidate → assigned_recruiter (User)
Candidate → Booking(s) → InterviewSlot + Interview
InterviewSlot → Location
InterviewSlot → hiring_manager (User)
Interview → InterviewFeedback
Interview (Round 2) → ObservationSheet → trainer (User)
Candidate → FastGemUpload (terminal stage)
User → Notification(s)
```

### Indexes (additions)

```sql
-- Booking lookups
CREATE INDEX idx_booking_slot_status ON bookings_booking (interview_slot_id, status);
CREATE INDEX idx_booking_candidate ON bookings_booking (candidate_id, status);

-- Notification bell badge count
CREATE INDEX idx_notification_unread ON notifications_notification (recipient_id, is_read) WHERE is_read = false;

-- Interview round filtering
CREATE INDEX idx_interview_round ON interviews_interview (interview_type, round);

-- Follow-up reminders (Celery Beat)
CREATE INDEX idx_candidate_followup ON candidates_candidate (follow_up_date) WHERE follow_up_date IS NOT NULL;
```

---

## 7. Candidate Lifecycle Architecture

### Current State Machine

```
FRESH BUCKET (11 statuses):
  never_contacted → contacted → unanswered / not_interested / asked_to_connect_later /
  wrong_number / invalid_contact / duplicate / do_not_contact / follow_up_due / interested

  "interested" triggers auto-promotion to Pipeline bucket

PIPELINE BUCKET (11 statuses):
  interested → screening_scheduled → screening_completed →
  interview_scheduled → interview_completed → submitted →
  selected → offer_released → joined

  Any non-terminal status → rejected | dropped
```

### V2 Lifecycle (master plan alignment)

The master plan describes these stages that are **currently missing**:

| Stage | Master Plan Section | Current Status | V2 Action |
|---|---|---|---|
| Recruiter calls candidate | §5-8 | ✅ CallLog exists, manual logging | Add RingCentral click-to-call integration |
| Screening / Initial Assessment | §9-11 | ✅ screening_scheduled/completed exist | Add InterviewFeedback for structured capture |
| Slot Selection & Booking | §12-15 | ⚠️ InterviewSlot exists but NO booking flow | **Build Booking module** |
| Round 1 Interview | §16-19 | ✅ interview_scheduled/completed exist | Link to Booking; add feedback form |
| Round 1 Result → Next Action | §20 | ⚠️ Only submitted/rejected/selected | Add `next_round` recommendation; auto-create Round 2 booking |
| Round 2 / Observation | §21-24 | ❌ Missing entirely | **Add round_2 pipeline statuses + ObservationSheet** |
| Training Assignment | §25-27 | ❌ No Trainer role or module | **Add trainer assignment + training_status** |
| Final Hiring Decision | §28-30 | ⚠️ selected/offer_released/joined exist | Add hiring committee feedback aggregation |
| FastGem Upload | §31-33 | ❌ Missing entirely | **Build FastGemUpload model + page** |
| Daily KPI Tracking | §34-36 | ❌ No KPI system | **Add daily_target on User + KPI dashboard widget** |

### V2 Pipeline Status Additions

```python
# New statuses to add to PIPELINE_STATUS_CHOICES:
PIPELINE_ROUND2_SCHEDULED = 'round2_scheduled'
PIPELINE_ROUND2_COMPLETED = 'round2_completed'
PIPELINE_OBSERVATION = 'observation'
PIPELINE_TRAINING = 'training'
PIPELINE_TRAINING_COMPLETED = 'training_completed'
PIPELINE_HIRED = 'hired'          # rename from 'joined' for clarity
PIPELINE_FASTGEM_UPLOADED = 'fastgem_uploaded'

# Updated transition map:
VALID_PIPELINE_TRANSITIONS = {
    'interested': ['screening_scheduled', 'rejected', 'dropped'],
    'screening_scheduled': ['screening_completed', 'rejected', 'dropped'],
    'screening_completed': ['interview_scheduled', 'rejected', 'dropped'],
    'interview_scheduled': ['interview_completed', 'rejected', 'dropped'],
    'interview_completed': ['round2_scheduled', 'submitted', 'rejected', 'dropped'],
    'round2_scheduled': ['round2_completed', 'rejected', 'dropped'],
    'round2_completed': ['observation', 'submitted', 'rejected', 'dropped'],
    'observation': ['training', 'rejected', 'dropped'],
    'training': ['training_completed', 'rejected', 'dropped'],
    'training_completed': ['submitted', 'rejected', 'dropped'],
    'submitted': ['selected', 'rejected', 'dropped'],
    'selected': ['offer_released', 'rejected', 'dropped'],
    'offer_released': ['hired', 'dropped'],
    'hired': ['fastgem_uploaded'],
    'fastgem_uploaded': [],
    'rejected': [],
    'dropped': [],
}
```

---

## 8. Booking & Slot Architecture

### Current Problem

`InterviewSlot` exists with capacity management (`book`/`unbook` actions), but:
- There is NO `Booking` model — `book()` just increments `booked_count`
- No record of WHICH candidate is booked into WHICH slot
- No connection between a slot booking and an Interview record
- The frontend `ManageSlotsPage` manages slots but has no candidate booking UI

### V2 Booking Flow

```
┌───────────────┐     ┌──────────────┐     ┌───────────────┐
│  Recruiter    │     │   Booking    │     │  Interview    │
│  selects      │────>│   created    │────>│  auto-created │
│  slot for     │     │  (pending)   │     │  on confirm   │
│  candidate    │     │              │     │               │
└───────────────┘     └──────┬───────┘     └───────┬───────┘
                             │                     │
                    ┌────────┴────────┐    ┌───────┴────────┐
                    │ Slot.booked_count│    │ Zoom meeting   │
                    │ incremented     │    │ Google event   │
                    │                 │    │ Email sent     │
                    └─────────────────┘    │ (all async)    │
                                           └────────────────┘
```

**Booking API:**

```
POST   /api/bookings/                    # Create booking (candidate + slot)
GET    /api/bookings/?candidate=X        # List bookings for candidate
GET    /api/bookings/?slot=X             # List bookings for slot
POST   /api/bookings/{id}/confirm/       # Confirm → creates Interview
POST   /api/bookings/{id}/cancel/        # Cancel → decrements slot count
GET    /api/bookings/{id}/               # Booking detail
```

**Business Rules:**
1. A candidate can have at most 1 active booking per round (round_1 or round_2)
2. Booking a candidate auto-increments `InterviewSlot.booked_count` and calls `refresh_status()`
3. Confirming a booking creates an `Interview` record and triggers async Zoom + Calendar + Email
4. Cancelling a booking decrements `booked_count` and updates candidate status
5. If a slot reaches `max_capacity`, further bookings are rejected
6. Bookings record which recruiter booked, enabling KPI tracking

---

## 9. Google Calendar Architecture

### Current Implementation

- Uses `InstalledAppFlow` from `google-auth-oauthlib` — opens a local browser for OAuth consent
- Stores credentials in a local `token.json` file
- Creates/updates/deletes calendar events synchronously in the request cycle
- Hardcoded calendar ID from settings

### Current Problems

1. **InstalledAppFlow cannot run on a headless production server** — it calls `run_local_server()` which opens port 8080 for OAuth callback
2. **Single calendar** — all interviews on one calendar regardless of location or interviewer
3. **Synchronous** — calendar API calls add 1-2 seconds to interview creation
4. **No attendee tracking** — creates events but doesn't manage attendee RSVPs

### V2 Architecture

**Switch to Google Service Account with Domain-Wide Delegation:**

```python
# V2 CalendarService
from google.oauth2 import service_account
from googleapiclient.discovery import build

class CalendarService:
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    def __init__(self):
        credentials = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_SERVICE_ACCOUNT_FILE,
            scopes=self.SCOPES
        )
        # Impersonate the calendar owner
        delegated = credentials.with_subject(settings.GOOGLE_CALENDAR_OWNER)
        self.service = build('calendar', 'v3', credentials=delegated)
```

**Key Changes:**
- Service Account JSON stored as encrypted file, path in env var
- Calendar creation runs as a **Celery task** — interview creation returns immediately
- Support multiple calendars: one per Location or one per HiringManager
- Attendees: candidate email + interviewer email + recruiter email (CC)
- Event body includes Zoom join link, candidate profile link, interview notes

---

## 10. Zoom Architecture

### Current Implementation

- `ZoomAccount` model stores `account_id`, `client_id`, `client_secret` in plaintext
- Server-to-Server OAuth: gets access token → creates meeting
- Per-account support exists (can associate a ZoomAccount with an Interview)
- Auto-creates meeting on Interview creation (synchronous)
- Test connection endpoint verifies credentials

### Current Problems

1. **Credentials in plaintext** — `client_secret` stored as `CharField` in database
2. **Synchronous** — meeting creation blocks the request
3. **No meeting lifecycle management** — no update/delete when interview is rescheduled/cancelled
4. **No participant tracking** — doesn't verify join/attendance

### V2 Architecture

**Credential Security:**
```python
# Move to IntegrationCredential with Fernet encryption
from cryptography.fernet import Fernet

class IntegrationCredential(models.Model):
    provider = models.CharField(max_length=30)  # 'zoom', 'google', 'ringcentral'
    account_label = models.CharField(max_length=100)
    _encrypted_data = models.TextField()  # Fernet-encrypted JSON
    
    def get_credentials(self):
        f = Fernet(settings.ENCRYPTION_KEY)
        return json.loads(f.decrypt(self._encrypted_data.encode()))
```

**Key Changes:**
- Zoom meeting creation → **Celery task** with retry logic
- When interview is cancelled, Zoom meeting is deleted (async)
- When interview is rescheduled, Zoom meeting is updated (async)
- Per-slot Zoom accounts: each `InterviewSlot` can reference a `ZoomAccount` for room-specific links
- Meeting details stored on Interview: `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url`, `zoom_password`

---

## 11. RingCentral Architecture

### Current State

- `CallLog` model has `Provider.RINGCENTRAL` choice
- `AppSetting` stores `ringcentral_client_id`, `ringcentral_client_secret`, `ringcentral_jwt_token`
- **ZERO integration code** — no RingCentral SDK, no API calls, no click-to-call

### V2 Architecture

**RingCentral Integration Scope:**

```
┌──────────────────┐
│  React Frontend  │
│  ┌──────────────┐│     ┌────────────────┐     ┌───────────────┐
│  │ Click-to-Call ├┼────>│ Django API     │────>│ RingCentral   │
│  │ Button       ││     │ /call/initiate │     │ RingOut API   │
│  └──────────────┘│     └────────┬───────┘     └───────┬───────┘
│  ┌──────────────┐│              │                     │
│  │ Call Status  ├┼<─────────────┘                     │
│  │ Widget       ││     (WebSocket update)             │
│  └──────────────┘│                                    │
└──────────────────┘           ┌─────────────┐          │
                               │ CallLog     │<─────────┘
                               │ created     │ (webhook or poll)
                               └─────────────┘
```

**Implementation Plan:**
1. **RingCentral SDK:** `ringcentral` Python package with JWT grant type
2. **RingOut API:** Initiates outbound call from recruiter's phone/extension to candidate's number
3. **Call Log Sync:** Webhook or periodic Celery task to pull call records and create `CallLog` entries
4. **Click-to-Call UI:** Phone icon on candidate cards → calls `/api/interviews/call-logs/initiate/`
5. **Call Disposition:** After call ends, recruiter selects outcome → updates candidate status

**API Endpoints:**
```
POST /api/integrations/ringcentral/call/        # Initiate RingOut call
GET  /api/integrations/ringcentral/call-status/  # Check active call status
POST /api/integrations/ringcentral/sync-logs/    # Manual log sync trigger
```

---

## 12. Authentication & RBAC

### Current Implementation

- `User` model with 3 roles: `admin`, `subadmin`, `recruiter`
- JWT via SimpleJWT with access + refresh token rotation
- Token blacklist on logout
- `ProtectedRoute` component with role-based access on frontend
- Backend: custom permission checks in views using `request.user.is_admin_or_subadmin`
- No `IsAdminOrSubadmin` DRF permission class (inline checks instead)

### Current Gaps

1. No `hiring_manager` or `trainer` roles
2. No forgot-password / password-reset-via-email flow
3. No session management (view active sessions, force logout)
4. No DRF permission classes — role checks scattered in view methods
5. No object-level permissions (any recruiter can edit any candidate)

### V2 Architecture

**Role Expansion:**

```python
class Role(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    SUBADMIN = 'subadmin', 'Subadmin'
    HIRING_MANAGER = 'hiring_manager', 'Hiring Manager'
    TRAINER = 'trainer', 'Trainer'
    RECRUITER = 'recruiter', 'Recruiter'
```

**Permission Classes (centralized):**

```python
# core/permissions.py
class IsAdminOrSubadmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('admin', 'subadmin')

class IsHiringManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'hiring_manager'

class CanManageCandidates(BasePermission):
    """Recruiter can only modify own assigned candidates (configurable)"""
    def has_object_permission(self, request, view, obj):
        if request.user.is_admin_or_subadmin:
            return True
        return obj.assigned_recruiter == request.user
```

**Forgot Password Flow:**
1. `POST /api/auth/forgot-password/` — sends reset email with token
2. `POST /api/auth/reset-password/` — validates token + sets new password
3. Uses Django's built-in `PasswordResetTokenGenerator`

---

## 13. Notification Architecture

### Current State

No notification system exists. All state changes are silent.

### V2 Architecture

```
┌───────────────────────────────────────────────────────┐
│                 Notification Service                   │
│                                                       │
│  Event Triggers:                                      │
│  ├─ Candidate assigned to recruiter                   │
│  ├─ Candidate status changed                          │
│  ├─ Booking created / confirmed / cancelled           │
│  ├─ Interview reminder (30 min before)                │
│  ├─ Follow-up due today                               │
│  ├─ Slot almost full (80% capacity)                   │
│  ├─ New batch upload completed                        │
│  ├─ Daily KPI summary                                 │
│  └─ Round 2 / Observation result submitted            │
│                                                       │
│  Delivery Channels:                                   │
│  ├─ In-app (bell icon) → WebSocket push               │
│  ├─ Email (async via Celery)                          │
│  └─ Browser push (future, if needed)                  │
└───────────────────────────────────────────────────────┘
```

**Django Channels Setup:**

```python
# notifications/consumers.py
class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        await self.channel_layer.group_add(f'user_{user.id}', self.channel_name)
        await self.accept()

    async def send_notification(self, event):
        await self.send_json(event['data'])
```

**Frontend Integration:**

```jsx
// useNotifications hook
const ws = new WebSocket(`ws://${host}/ws/notifications/`);
ws.onmessage = (e) => {
  const notification = JSON.parse(e.data);
  setUnreadCount(prev => prev + 1);
  showToast(notification.title);
};
```

**API Endpoints:**
```
GET    /api/notifications/              # List (paginated, newest first)
POST   /api/notifications/mark-read/    # Mark one or all as read
GET    /api/notifications/unread-count/  # Badge count
PATCH  /api/notifications/preferences/  # Update preferences
```

---

## 14. Background Jobs

### Current State

All operations are synchronous:
- Zoom meeting creation: 1-3s blocking
- Google Calendar event: 1-2s blocking  
- Email dispatch: 0.5-2s blocking
- CSV upload processing: 5-30s blocking (blocks entire request)

### V2 Architecture: Celery + Redis

**Worker Configuration:**

```python
# celery.py
app = Celery('ats_project')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Queues
CELERY_TASK_ROUTES = {
    'interviews.tasks.create_zoom_meeting': {'queue': 'integrations'},
    'interviews.tasks.create_calendar_event': {'queue': 'integrations'},
    'interviews.tasks.send_email': {'queue': 'email'},
    'candidates.tasks.process_upload': {'queue': 'uploads'},
    'notifications.tasks.send_notification': {'queue': 'notifications'},
}
```

**Task Categories:**

| Category | Tasks | Queue | Priority |
|---|---|---|---|
| **Integration** | Zoom create/update/delete, Calendar create/update/delete, RingCentral call | `integrations` | High |
| **Email** | Interview confirmation, reminder, cancellation, follow-up, daily digest | `email` | Medium |
| **Upload** | CSV/XLSX processing, duplicate detection, batch assignment | `uploads` | Medium |
| **Notification** | In-app + email notification delivery | `notifications` | Low |
| **Scheduled** | Interview reminders (30 min), follow-up due alerts, daily KPI report, slot availability check | `beat` | Low |

**Celery Beat Schedule:**

```python
CELERY_BEAT_SCHEDULE = {
    'interview-reminders': {
        'task': 'interviews.tasks.send_upcoming_reminders',
        'schedule': crontab(minute='*/15'),  # Every 15 min
    },
    'follow-up-alerts': {
        'task': 'candidates.tasks.check_follow_ups',
        'schedule': crontab(hour=9, minute=0),  # 9 AM daily
    },
    'daily-kpi-summary': {
        'task': 'reports.tasks.send_daily_kpi',
        'schedule': crontab(hour=18, minute=0),  # 6 PM daily
    },
    'sync-ringcentral-logs': {
        'task': 'integrations.tasks.sync_call_logs',
        'schedule': crontab(minute='*/30'),  # Every 30 min
    },
}
```

---

## 15. Performance Strategy

### Current Strengths

- Database indexes on key lookup patterns (bucket+status, recruiter+bucket, email+phone)
- Pagination on all list endpoints
- `select_related` / `prefetch_related` used in views
- `call_count` annotation avoids N+1

### V2 Improvements

| Area | Strategy |
|---|---|
| **Query Optimization** | Add `django-debug-toolbar` in dev; audit all endpoints for N+1; add `only()` on list serializers |
| **Caching** | Redis cache for: dashboard aggregations (60s TTL), status option lists (300s TTL), user lists (120s TTL) |
| **Frontend** | Add React Query (TanStack Query) for data fetching with cache + stale-while-revalidate |
| **Bulk Operations** | Batch status updates, batch reassignment using `bulk_update()` with `F()` expressions |
| **Upload Processing** | Move CSV/XLSX processing to Celery task; use `bulk_create()` with `batch_size=500` |
| **Pagination** | Cursor-based pagination for large tables (candidates, activity logs) instead of offset |
| **Database** | Add `pg_trgm` extension for fuzzy name search; consider partial indexes for common filters |
| **Static Assets** | Vite already handles code splitting + tree shaking; add gzip/brotli compression at Nginx level |

---

## 16. Security Strategy

### Current Vulnerabilities

1. **Zoom credentials in plaintext** in `ZoomAccount.client_secret`
2. **Google Calendar** uses local file-based `token.json` — insecure on shared servers
3. **No field-level encryption** for sensitive candidate data (phone, email)
4. **SECRET_KEY** has a hardcoded default fallback: `'change-me-in-production-use-a-long-random-string'`
5. **No rate limiting** on login endpoint or API
6. **No CSRF** on API (disabled for JWT, but no rate limiting compensates)
7. **No audit logging** of who accessed which candidate records (action log exists but doesn't track reads)

### V2 Security Measures

| Measure | Implementation |
|---|---|
| **Credential Encryption** | Fernet symmetric encryption for all API credentials stored in DB. Encryption key from env var, never in code or DB |
| **Rate Limiting** | `django-ratelimit` or DRF throttling: 5 login attempts/min, 100 API calls/min per user |
| **Input Validation** | DRF serializer validation already good; add phone format validation with `phonenumbers` library |
| **CORS** | Tighten CORS_ALLOWED_ORIGINS to specific frontend domain (currently may be wide open in dev) |
| **Secret Key** | Remove fallback default; require `DJANGO_SECRET_KEY` env var (crash on startup if missing) |
| **SQL Injection** | Already protected by Django ORM; audit any `raw()` or `extra()` calls |
| **XSS** | React auto-escapes; audit any `dangerouslySetInnerHTML` usage |
| **HTTPS** | Enforce `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` in production |
| **Audit Trail** | Extend activity log to capture data access (candidate detail view) for compliance |
| **File Upload** | Validate file type (magic bytes, not just extension) for CSV/XLSX uploads; limit file size |

---

## 17. Testing Strategy

### Current State

No tests exist in the codebase.

### V2 Testing Plan

| Level | Coverage Target | Framework | Focus |
|---|---|---|---|
| **Unit Tests** | Core business logic | `pytest` + `pytest-django` | Status transitions, round-robin assignment, duplicate detection, booking rules |
| **API Tests** | All endpoints | `pytest` + DRF `APIClient` | CRUD, permissions, edge cases, error responses |
| **Integration Tests** | Service layer | `pytest` + `responses` (mock HTTP) | Zoom, Calendar, Email, RingCentral service methods |
| **Frontend Tests** | Critical paths | `Vitest` + `React Testing Library` | Candidate cards, booking flow, status updates, form validation |
| **E2E Tests** | Golden paths | `Playwright` | Login → Upload → Call → Book → Interview → Hire flow |

**Priority Order (test most critical first):**
1. Status transition validation (candidate state machine)
2. Booking creation + capacity enforcement
3. Permission checks (role-based access)
4. Upload processing (CSV parsing, duplicate detection)
5. Interview creation chain (booking → interview → zoom → calendar → email)

---

## 18. Deployment Architecture

### Recommended Production Setup

```
┌─────────────────────────────────────────────────────┐
│                    Nginx                             │
│  ├─ /              → React static build             │
│  ├─ /api/*         → Gunicorn (Django)               │
│  ├─ /ws/*          → Daphne (Channels)               │
│  └─ /admin/        → Gunicorn (Django)               │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────┴────┐   ┌─────┴─────┐  ┌────┴──────┐
   │Gunicorn │   │  Daphne   │  │  Celery   │
   │ (WSGI)  │   │  (ASGI)   │  │  Worker   │
   │ 4 workers│  │ WebSocket │  │ 2 workers │
   └────┬────┘   └─────┬─────┘  └────┬──────┘
        │              │              │
   ┌────┴──────────────┴──────────────┴─────┐
   │           PostgreSQL + Redis            │
   └─────────────────────────────────────────┘
```

**Docker Compose services:**
- `nginx` — reverse proxy + static files
- `django` — Gunicorn with 4 workers
- `channels` — Daphne for WebSocket
- `celery-worker` — 2 workers, 3 queues
- `celery-beat` — scheduler (single instance)
- `redis` — broker + cache
- `postgres` — database

**Environment Configuration:**
- All secrets via environment variables (never in code)
- `.env.example` with all required vars documented
- Separate `.env.production` and `.env.development`

---

## 19. Development Milestones

| Milestone | Scope | Estimated Effort | Dependencies |
|---|---|---|---|
| **M1: Foundation** | Celery + Redis setup, centralized permissions, forgot-password, error boundaries, new roles (hiring_manager, trainer) | 2-3 days | None |
| **M2: Booking Flow** | Booking model + API + frontend, link InterviewSlot → Booking → Interview, booking UI on candidate detail page | 3-4 days | M1 |
| **M3: Extended Pipeline** | Round 2 statuses, InterviewFeedback model, ObservationSheet, trainer assignment, updated state machine | 3-4 days | M2 |
| **M4: Notifications** | Notification model, Django Channels, WebSocket, bell icon, notification preferences, email notifications via Celery | 2-3 days | M1 |
| **M5: Integrations** | RingCentral click-to-call, Google Calendar Service Account migration, Zoom credential encryption, email template management | 3-4 days | M1, M4 |
| **M6: FastGem + KPI** | FastGem upload module, daily KPI targets, recruiter productivity dashboard, bulk operations, advanced reports | 2-3 days | M3 |

**Total estimated effort: 15-21 days**

**Milestone order rationale:**
- M1 first because Celery is required by M2-M5 (async operations)
- M2 before M3 because the booking flow is the critical gap blocking the hiring lifecycle
- M4 can run in parallel with M2/M3 (independent module)
- M5 depends on M1 (Celery) and M4 (notification delivery)
- M6 last because it extends completed pipeline stages

---

## 20. Risks / Decisions Required

### Decisions the Stakeholder Must Make

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Round 2 scope** — Is Round 2 always at a different location with a different interviewer, or can it reuse Round 1 setup? | A) Separate slot pool for Round 2 B) Same slot pool, tagged by round | **B** — simpler, add `round_type` field to InterviewSlot |
| 2 | **FastGem integration** — Is FastGem an external system with an API, or is it a manual data export/upload? | A) API integration B) Manual file upload C) Both | Need clarification — affects whether we build API connector or file export |
| 3 | **RingCentral scope** — Full click-to-call with auto-logging, or just manual call log entry with RingCentral as metadata? | A) Full integration (RingOut + webhooks) B) Click-to-call only C) Manual logging only | **A** if RingCentral account is available; **C** as fallback |
| 4 | **Trainer role** — Do trainers log into the ATS, or do recruiters/admins manage observation sheets on their behalf? | A) Trainers have login + limited dashboard B) Admins enter on behalf | **A** — reduces admin burden, enables direct feedback entry |
| 5 | **KPI configuration** — Are daily targets per-recruiter or global? Are they admin-configurable? | A) Global target in AppSetting B) Per-recruiter targets C) Both with per-recruiter override | **C** — most flexible |
| 6 | **Email templates** — Should email templates be editable by admin in the UI, or hardcoded with variable substitution? | A) DB-stored, admin-editable B) Hardcoded in code | **A** — currently hardcoded, should be admin-manageable |
| 7 | **Candidate data ownership** — Should recruiters only see their assigned candidates, or all candidates? | A) Only assigned B) All visible, only assigned editable C) All visible and editable | Currently **C**; recommend **B** for data governance |
| 8 | **Google Calendar** — One shared calendar or per-location/per-interviewer calendars? | A) Single shared B) Per-location C) Per-interviewer | **B** — maps to physical interview rooms |

### Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Celery adds infrastructure complexity** | Redis must be available; worker crashes lose in-flight tasks | Use Redis persistence (AOF); Celery task acks_late + retry; Docker healthchecks |
| **WebSocket scaling** | Django Channels requires ASGI server + Redis channel layer | Start with single Daphne instance; scale horizontally later if needed |
| **Google Service Account migration** | Existing calendar events created with old auth won't be manageable | One-time migration script to re-create events under service account |
| **RingCentral rate limits** | API rate limits may affect bulk calling periods | Implement exponential backoff; queue calls via Celery |
| **Database migration complexity** | Adding 8+ models and modifying 4 existing ones | Run migrations per-milestone; test on staging DB copy first |
| **Data migration** | Existing InterviewSlot.booked_count has no Booking records to back it | Reset counts or create synthetic Booking records for existing data |

---

## 21. Final Recommendation

**Build incrementally on the existing codebase.** The Django + React stack is appropriate and the code quality is solid. The system needs **depth, not breadth** — the existing modules cover the right domains but stop short of the full hiring lifecycle.

**The three highest-impact changes are:**

1. **Add Celery + Redis** (M1) — unlocks async operations across the entire system, removes the biggest production reliability risk
2. **Build the Booking module** (M2) — bridges the critical gap between InterviewSlot and Interview, enabling the slot → book → interview → hire flow that the master plan centers on
3. **Extend the pipeline state machine** (M3) — adds Round 2, Observation, Training, and FastGem stages to complete the candidate lifecycle from upload to hire

**Do not attempt a full rewrite.** The 22 existing frontend pages, 14 models, and 7 service files represent significant working value. Evolve them milestone by milestone, testing each milestone before starting the next.

**Awaiting your approval to proceed to the Implementation Roadmap.**

---

*Document generated from system audit of the ATS codebase against the 46-section master plan.*
*Current system: 14 models, 22 pages, 7 services, 24 routes.*
*Gap analysis: ~60% of master plan features missing or incomplete.*
