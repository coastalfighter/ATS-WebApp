# ATS V2 — Implementation Roadmap

Based on the approved Architecture Recommendation, this document breaks down each milestone into concrete tasks with file-level specificity.

---

## Milestone 1: Foundation (Days 1-3)

**Goal:** Infrastructure for async operations, centralized permissions, new roles, and forgot-password flow. Everything else builds on this.

### M1.1 — Celery + Redis Setup

| Task | Files | Detail |
|---|---|---|
| Install dependencies | `backend/requirements.txt` | Add `celery[redis]`, `redis`, `django-celery-beat` |
| Celery app config | `backend/ats_project/celery.py` (new) | Create Celery app, autodiscover_tasks, queue routing config |
| Django settings | `backend/ats_project/settings.py` | Add `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_BEAT_SCHEDULE`, `django_celery_beat` to INSTALLED_APPS |
| Init module update | `backend/ats_project/__init__.py` | Import celery app for Django auto-discovery |
| Verify setup | Manual test | Run `celery -A ats_project worker -l info` to confirm connection |

### M1.2 — Async Email Service

| Task | Files | Detail |
|---|---|---|
| Create email tasks | `backend/interviews/tasks.py` (new) | `send_interview_email.delay()` — wraps existing `EmailService` methods as Celery tasks |
| Update interview creation | `backend/interviews/views.py` | Replace synchronous `EmailService().send_*()` calls with `.delay()` task calls |
| Error handling | `backend/interviews/tasks.py` | Add `autoretry_for=(SMTPException,)`, `retry_backoff=True`, `max_retries=3` |

### M1.3 — Centralized Permission Classes

| Task | Files | Detail |
|---|---|---|
| Create permission module | `backend/core/permissions.py` (new) | `IsAdminOrSubadmin`, `IsHiringManager`, `IsTrainer`, `IsAdminOnly` permission classes |
| Refactor views | `backend/candidates/views.py`, `backend/interviews/views.py`, `backend/reports/views.py` | Replace inline `if not request.user.is_admin_or_subadmin` checks with `permission_classes = [IsAdminOrSubadmin]` |
| Update DRF defaults | `backend/ats_project/settings.py` | Set `DEFAULT_PERMISSION_CLASSES` to `[IsAuthenticated]` |

### M1.4 — New Roles (Hiring Manager, Trainer)

| Task | Files | Detail |
|---|---|---|
| Extend User.Role | `backend/accounts/models.py` | Add `HIRING_MANAGER = 'hiring_manager'` and `TRAINER = 'trainer'` to Role choices |
| Add role properties | `backend/accounts/models.py` | `is_hiring_manager`, `is_trainer` properties |
| Update serializers | `backend/accounts/serializers.py` | Include new roles in validation choices |
| Update frontend auth | `frontend/src/context/AuthContext.jsx` | Add `isHiringManager`, `isTrainer` helper booleans |
| Update sidebar | `frontend/src/components/layout/Sidebar.jsx` | Show hiring-manager-specific and trainer-specific nav items |
| Update command palette | `frontend/src/components/common/CommandPalette.jsx` | Add role-based filtering for new role-specific pages |
| Migration | `backend/accounts/migrations/` | Auto-generated for Role choices change |

### M1.5 — Forgot Password Flow

| Task | Files | Detail |
|---|---|---|
| Backend endpoints | `backend/accounts/views.py` | `ForgotPasswordView` (POST email → sends reset link), `ResetPasswordView` (POST token + new password) |
| Token generation | `backend/accounts/views.py` | Use Django's `PasswordResetTokenGenerator` + `urlsafe_base64_encode(force_bytes(user.pk))` |
| Email template | `backend/interviews/services/email_service.py` | Add `send_password_reset_email()` method (Celery async) |
| URLs | `backend/accounts/urls.py` | `/api/auth/forgot-password/`, `/api/auth/reset-password/` |
| Frontend page | `frontend/src/pages/ForgotPasswordPage.jsx` (new) | Email input form → success message |
| Frontend page | `frontend/src/pages/ResetPasswordPage.jsx` (new) | Token + new password form |
| Routes | `frontend/src/App.jsx` | Add `/forgot-password` and `/reset-password/:token` routes (public, no auth required) |
| Login page link | `frontend/src/pages/LoginPage.jsx` | Add "Forgot password?" link below login form |

### M1.6 — Frontend Error Boundaries

| Task | Files | Detail |
|---|---|---|
| Error boundary component | `frontend/src/components/common/ErrorBoundary.jsx` (new) | React class component with `componentDidCatch`, fallback UI with retry button |
| Wrap routes | `frontend/src/App.jsx` | Wrap `<MainLayout>` with `<ErrorBoundary>` |
| API error handling | `frontend/src/services/api.js` | Add global error toast via interceptor (non-401 errors) |

### M1.7 — Credential Encryption Foundation

| Task | Files | Detail |
|---|---|---|
| Install cryptography | `backend/requirements.txt` | Add `cryptography` package |
| Encryption utility | `backend/core/encryption.py` (new) | `encrypt_value()`, `decrypt_value()` using Fernet with key from `settings.ENCRYPTION_KEY` env var |
| Settings | `backend/ats_project/settings.py` | Add `ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY')` |

**M1 Deliverables:**
- Celery worker runs and processes tasks
- All email sending is async
- Permission classes used consistently across all views
- hiring_manager and trainer roles functional
- Forgot-password email flow works end to end
- Error boundaries catch frontend crashes gracefully
- Encryption utility ready for M5 credential migration

---

## Milestone 2: Booking Flow (Days 4-7)

**Goal:** Bridge InterviewSlot → Candidate with a Booking model. This is the critical missing piece that connects the recruiter workflow to the interview lifecycle.

### M2.1 — Booking Model & API

| Task | Files | Detail |
|---|---|---|
| Create bookings app | `backend/bookings/` (new app) | `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tasks.py` |
| Booking model | `backend/bookings/models.py` | Fields: `candidate` FK, `interview_slot` FK, `booked_by` FK (User), `status` (pending/confirmed/cancelled/no_show), `round` (round_1/round_2), `interview` FK (nullable, set on confirm), `cancellation_reason`, `created_at`, `updated_at` |
| BookingActivityLog | `backend/bookings/models.py` | Fields: `booking` FK, `action`, `old_value`, `new_value`, `performed_by` FK, `created_at` |
| Serializers | `backend/bookings/serializers.py` | `BookingListSerializer` (nested candidate name, slot date/time, location), `BookingCreateSerializer` (validate capacity, validate no duplicate active booking per candidate per round), `BookingDetailSerializer` |
| ViewSet | `backend/bookings/views.py` | `BookingViewSet` with `create`, `list`, `retrieve` + custom actions: `confirm/` (creates Interview async), `cancel/` (decrements slot), `mark_no_show/` |
| URLs | `backend/bookings/urls.py` | Router-based: `/api/bookings/` |
| Project URLs | `backend/ats_project/urls.py` | Add `path('api/bookings/', include('bookings.urls'))` |
| Settings | `backend/ats_project/settings.py` | Add `'bookings'` to INSTALLED_APPS |
| Celery tasks | `backend/bookings/tasks.py` | `on_booking_confirmed` task: create Interview, trigger Zoom meeting, Calendar event, send confirmation email |
| Migration | `backend/bookings/migrations/` | Initial migration |

### M2.2 — InterviewSlot Enhancements

| Task | Files | Detail |
|---|---|---|
| Add round_type field | `backend/interviews/models.py` | `InterviewSlot.round_type`: `round_1` | `round_2`, default `round_1` |
| Link to bookings | `backend/interviews/models.py` | Add reverse relation documentation (Booking FK → InterviewSlot) |
| Update slot serializer | `backend/interviews/serializers.py` | Include `round_type`, include `bookings_count` annotation, include `available_capacity` computed field |
| Update slot viewset | `backend/interviews/views.py` | Update `book()` and `unbook()` to work through Booking model instead of raw count manipulation |
| Migration | `backend/interviews/migrations/` | Add round_type field |

### M2.3 — Interview Model Enhancements

| Task | Files | Detail |
|---|---|---|
| Add round field | `backend/interviews/models.py` | `Interview.round`: `round_1` | `round_2`, default `round_1` |
| Add booking FK | `backend/interviews/models.py` | `Interview.booking` FK → Booking (nullable, for backwards compatibility with existing interviews) |
| Add slot FK | `backend/interviews/models.py` | `Interview.interview_slot` FK → InterviewSlot (nullable) |
| Update serializers | `backend/interviews/serializers.py` | Include `round`, `booking_id`, `interview_slot_id` in serializers |
| Migration | `backend/interviews/migrations/` | Add fields |

### M2.4 — Booking Frontend

| Task | Files | Detail |
|---|---|---|
| API service | `frontend/src/services/api.js` | Add `bookingsAPI`: `list`, `create`, `confirm`, `cancel`, `markNoShow` |
| Book Candidate Modal | `frontend/src/components/bookings/BookCandidateModal.jsx` (new) | Select available slot (filtered by date, location, round) → create booking. Shows slot availability (X/Y booked) |
| Booking list on candidate detail | `frontend/src/pages/CandidateDetailPage.jsx` | Add "Bookings" tab showing candidate's booking history with status badges |
| Booking action on pipeline cards | `frontend/src/pages/PipelineCandidatesPage.jsx` | Add "Book Interview" button on cards with status `interested` or `screening_completed` or `interview_completed` |
| Slot bookings view | `frontend/src/pages/ManageSlotsPage.jsx` | Add expandable row or modal showing which candidates are booked into each slot |
| Sidebar link | `frontend/src/components/layout/Sidebar.jsx` | Add "Bookings" under Scheduling section |
| Route | `frontend/src/App.jsx` | Add `/bookings` route (optional — booking is primarily accessed from candidate context) |

**M2 Deliverables:**
- Recruiter can book a candidate into an available interview slot
- Booking confirmation auto-creates Interview + triggers Zoom/Calendar/Email (async)
- Slot capacity enforced — fully booked slots reject new bookings
- Candidate can have only 1 active booking per round
- Booking history visible on candidate detail page
- Slot detail shows booked candidates

---

## Milestone 3: Extended Pipeline (Days 8-11)

**Goal:** Complete the candidate lifecycle with Round 2, Observation, Training, and extended statuses.

### M3.1 — Extended Status Machine

| Task | Files | Detail |
|---|---|---|
| New pipeline statuses | `backend/candidates/constants.py` | Add: `round2_scheduled`, `round2_completed`, `observation`, `training`, `training_completed`, `hired`, `fastgem_uploaded` |
| Update transitions map | `backend/candidates/constants.py` | Extend `VALID_PIPELINE_TRANSITIONS` with new status paths (see Architecture Recommendation §7) |
| Update status service | `backend/candidates/services/status_transition.py` | Handle new statuses in validation; auto-create Round 2 booking opportunity on `interview_completed → round2_scheduled` |
| Update summary endpoint | `backend/candidates/views.py` | Include new statuses in pipeline-summary counts |
| Frontend status badges | `frontend/src/index.css` | Add badge colors for new statuses |
| Pipeline page cards | `frontend/src/pages/PipelineCandidatesPage.jsx` | Add summary cards for new statuses; update inline status dropdown with new options |

### M3.2 — Interview Feedback Model

| Task | Files | Detail |
|---|---|---|
| Model | `backend/interviews/models.py` | `InterviewFeedback`: `interview` FK, `submitted_by` FK (User), `round` (round_1/round_2), `rating` (1-5 IntegerField), `strengths` TextField, `weaknesses` TextField, `recommendation` (hire/reject/next_round/hold), `created_at` |
| Serializers | `backend/interviews/serializers.py` | `InterviewFeedbackSerializer`, `InterviewFeedbackCreateSerializer` |
| ViewSet | `backend/interviews/views.py` | `InterviewFeedbackViewSet` — create (hiring_manager or admin), list by interview |
| URLs | `backend/interviews/urls.py` | Register feedback viewset |
| Frontend component | `frontend/src/components/interviews/FeedbackForm.jsx` (new) | Rating stars, strengths/weaknesses text, recommendation dropdown |
| Candidate detail integration | `frontend/src/pages/CandidateDetailPage.jsx` | Show feedback under each interview in the interviews tab |
| Migration | `backend/interviews/migrations/` | Add InterviewFeedback model |

### M3.3 — Observation Sheet

| Task | Files | Detail |
|---|---|---|
| Model | `backend/interviews/models.py` | `ObservationSheet`: `interview` FK (Round 2), `trainer` FK (User), `observation_date` DateField, `performance_score` IntegerField(1-10), `communication_score` IntegerField(1-10), `technical_score` IntegerField(1-10), `notes` TextField, `recommendation` (proceed/extend_training/reject), `created_at` |
| Serializers | `backend/interviews/serializers.py` | `ObservationSheetSerializer`, `ObservationSheetCreateSerializer` |
| ViewSet | `backend/interviews/views.py` | `ObservationSheetViewSet` — create (trainer or admin), list by interview or candidate |
| URLs | `backend/interviews/urls.py` | Register observation viewset |
| Frontend page | `frontend/src/pages/ObservationPage.jsx` (new) | Trainer fills observation form; shows candidate history |
| Candidate detail | `frontend/src/pages/CandidateDetailPage.jsx` | Show observation results in timeline |
| Route | `frontend/src/App.jsx` | Add `/observations` route |
| Migration | `backend/interviews/migrations/` | Add ObservationSheet model |

### M3.4 — Trainer Assignment

| Task | Files | Detail |
|---|---|---|
| Candidate trainer field | `backend/candidates/models.py` | Add `assigned_trainer` FK → User (nullable) |
| Assignment API | `backend/candidates/views.py` | Add `assign_trainer` action on CandidateViewSet |
| Activity logging | `backend/candidates/constants.py` | Add `ACTION_TRAINER_ASSIGNED` action type |
| Frontend | `frontend/src/pages/CandidateDetailPage.jsx` | Add "Assign Trainer" button (visible when status is `observation` or `training`) |
| Pipeline cards | `frontend/src/pages/PipelineCandidatesPage.jsx` | Show assigned trainer name on cards in training statuses |
| Migration | `backend/candidates/migrations/` | Add assigned_trainer field |

### M3.5 — Additional Candidate Fields

| Task | Files | Detail |
|---|---|---|
| Model fields | `backend/candidates/models.py` | Add `date_of_birth` (DateField, nullable), `experience_years` (DecimalField, nullable), `current_company` (CharField), `current_designation` (CharField) |
| Serializers | `backend/candidates/serializers.py` | Include new fields in create/update/detail serializers |
| Upload handler | `backend/candidates/services/import_handler.py` | Add new fields to OPTIONAL_COLUMNS with aliases |
| Individual form | `frontend/src/pages/UploadCandidatesPage.jsx` | Add new fields to the individual candidate form |
| Candidate detail | `frontend/src/pages/CandidateDetailPage.jsx` | Display new fields in profile section |
| Migration | `backend/candidates/migrations/` | Add new fields |

**M3 Deliverables:**
- Pipeline statuses cover the full lifecycle: interested → ... → hired → fastgem_uploaded
- Hiring managers submit structured feedback after interviews
- Trainers submit observation sheets for Round 2 candidates
- Candidates can be assigned to trainers
- Additional candidate profile fields captured during upload and individual entry

---

## Milestone 4: Notifications (Days 8-10, parallel with M3)

**Goal:** In-app notification system with real-time delivery via WebSocket.

### M4.1 — Notification Backend

| Task | Files | Detail |
|---|---|---|
| Create notifications app | `backend/notifications/` (new app) | `models.py`, `serializers.py`, `views.py`, `urls.py`, `services.py`, `tasks.py` |
| Notification model | `backend/notifications/models.py` | `recipient` FK (User), `title` CharField, `message` TextField, `category` (info/warning/action), `link` CharField (optional deep-link path like `/candidates/123`), `is_read` BooleanField, `created_at` |
| NotificationPreference model | `backend/notifications/models.py` | OneToOne with User: `email_on_booking` bool, `email_on_assignment` bool, `email_on_interview` bool, `in_app_enabled` bool (all default True) |
| Serializers | `backend/notifications/serializers.py` | `NotificationSerializer`, `NotificationPreferenceSerializer` |
| ViewSet | `backend/notifications/views.py` | `list` (paginated, filtered by is_read), `mark_read` action (single or all), `unread_count` action, `preferences` CRUD |
| URLs | `backend/notifications/urls.py` | `/api/notifications/`, `/api/notifications/mark-read/`, `/api/notifications/unread-count/`, `/api/notifications/preferences/` |
| NotificationService | `backend/notifications/services.py` | `create_notification(recipient, title, message, category, link)` — saves to DB, sends to WebSocket channel, optionally queues email |
| Celery tasks | `backend/notifications/tasks.py` | `send_notification_email` for email channel delivery |
| Settings | `backend/ats_project/settings.py` | Add `'notifications'` to INSTALLED_APPS |
| Migration | `backend/notifications/migrations/` | Initial migration |

### M4.2 — Django Channels + WebSocket

| Task | Files | Detail |
|---|---|---|
| Install dependencies | `backend/requirements.txt` | Add `channels`, `channels-redis` |
| ASGI config | `backend/ats_project/asgi.py` | Configure `ProtocolTypeRouter` with `URLRouter` for WebSocket |
| Channel settings | `backend/ats_project/settings.py` | Add `CHANNEL_LAYERS` config with Redis backend, add `'channels'` to INSTALLED_APPS |
| WS routing | `backend/notifications/routing.py` (new) | WebSocket URL pattern: `ws/notifications/` |
| Consumer | `backend/notifications/consumers.py` (new) | `NotificationConsumer(AsyncJsonWebsocketConsumer)`: authenticate via JWT query param, join user-specific group, send notification events |
| JWT WS auth | `backend/notifications/middleware.py` (new) | WebSocket middleware to extract JWT from query string and authenticate |

### M4.3 — Notification Triggers (wire into existing flows)

| Task | Files | Detail |
|---|---|---|
| Candidate assignment | `backend/candidates/services/assignment.py` | After assignment → `NotificationService.create(recruiter, "New candidate assigned", ...)` |
| Status change | `backend/candidates/views.py` | After status update → notify assigned recruiter |
| Booking created | `backend/bookings/views.py` | Notify hiring manager when a candidate is booked into their slot |
| Booking confirmed | `backend/bookings/tasks.py` | Notify candidate's recruiter when booking is confirmed |
| Interview reminder | `backend/notifications/tasks.py` | Celery Beat: 30 minutes before interview → notify recruiter + hiring manager |
| Follow-up due | `backend/notifications/tasks.py` | Celery Beat: daily at 9 AM → notify recruiters of today's follow-ups |
| Upload complete | `backend/candidates/views.py` (or task) | Notify uploader when batch processing completes |

### M4.4 — Notification Frontend

| Task | Files | Detail |
|---|---|---|
| API service | `frontend/src/services/api.js` | Add `notificationsAPI`: `list`, `markRead`, `markAllRead`, `unreadCount`, `preferences` |
| WebSocket hook | `frontend/src/hooks/useNotifications.js` (new) | Connect to `ws://host/ws/notifications/?token=JWT`, parse messages, update unread count |
| Bell icon component | `frontend/src/components/layout/NotificationBell.jsx` (new) | Bell icon in header with unread badge count, dropdown panel showing recent notifications |
| Notification dropdown | `frontend/src/components/layout/NotificationPanel.jsx` (new) | Scrollable list of notifications with read/unread styling, click to navigate to `link` path |
| Header integration | `frontend/src/components/layout/MainLayout.jsx` | Add `<NotificationBell />` to header bar |
| Preferences page | `frontend/src/pages/ProfilePage.jsx` | Add notification preferences section |
| Toast component | `frontend/src/components/common/Toast.jsx` (new) | Brief pop-up toast for real-time notifications |

**M4 Deliverables:**
- Bell icon in header shows unread notification count
- Dropdown shows notification list with timestamps and categories
- Clicking a notification navigates to the relevant page
- Real-time delivery via WebSocket — no polling
- Notifications triggered by key workflow events
- Celery Beat sends scheduled reminders (interview, follow-up)
- Notification preferences allow users to control email delivery

---

## Milestone 5: Integrations (Days 12-15)

**Goal:** RingCentral click-to-call, Google Calendar Service Account, Zoom credential encryption, email template management.

### M5.1 — Integration Credential Store

| Task | Files | Detail |
|---|---|---|
| Create integrations app | `backend/integrations/` (new app) | `models.py`, `services/`, `views.py`, `urls.py`, `admin.py` |
| IntegrationCredential model | `backend/integrations/models.py` | `provider` (zoom/google/ringcentral), `account_label`, `_encrypted_data` TextField (Fernet), `is_active`, `last_verified_at`, `created_at` |
| Encrypt/decrypt methods | `backend/integrations/models.py` | `set_credentials(dict)`, `get_credentials() → dict` using `core/encryption.py` |
| Migrate Zoom credentials | Data migration | Move `ZoomAccount.client_id/client_secret/account_id` into `IntegrationCredential` records; `ZoomAccount` keeps FK reference |
| Admin UI | `backend/integrations/admin.py` | Register with masked credential display |
| Settings | `backend/ats_project/settings.py` | Add `'integrations'` to INSTALLED_APPS |
| Migration | `backend/integrations/migrations/` | Initial + data migration |

### M5.2 — Google Calendar Service Account

| Task | Files | Detail |
|---|---|---|
| Refactor CalendarService | `backend/interviews/services/calendar_service.py` | Replace `InstalledAppFlow` with `service_account.Credentials.from_service_account_file()` |
| Settings | `backend/ats_project/settings.py` | Add `GOOGLE_SERVICE_ACCOUNT_FILE`, `GOOGLE_CALENDAR_OWNER`, `GOOGLE_CALENDAR_ID` |
| Async calendar tasks | `backend/interviews/tasks.py` | `create_calendar_event.delay()`, `update_calendar_event.delay()`, `delete_calendar_event.delay()` |
| Update interview creation | `backend/interviews/views.py` | Replace synchronous calendar call with async task |
| Multi-calendar support | `backend/interviews/services/calendar_service.py` | Accept calendar_id parameter, default to Location-based calendar mapping |

### M5.3 — Zoom Credential Encryption

| Task | Files | Detail |
|---|---|---|
| Update ZoomService | `backend/interviews/services/zoom_service.py` | Read credentials from `IntegrationCredential` instead of plaintext `ZoomAccount` fields |
| Async Zoom tasks | `backend/interviews/tasks.py` | `create_zoom_meeting.delay()`, `delete_zoom_meeting.delay()`, `update_zoom_meeting.delay()` |
| Meeting lifecycle | `backend/interviews/tasks.py` | On interview cancel → delete Zoom meeting; on reschedule → update meeting time |
| Update interview views | `backend/interviews/views.py` | Replace synchronous Zoom calls with async tasks |

### M5.4 — RingCentral Integration

| Task | Files | Detail |
|---|---|---|
| Install SDK | `backend/requirements.txt` | Add `ringcentral` package |
| RingCentralService | `backend/integrations/services/ringcentral_service.py` (new) | JWT auth, `initiate_ringout(from_number, to_number)`, `get_call_status(session_id)`, `fetch_call_logs(date_from, date_to)` |
| API endpoints | `backend/integrations/views.py` | `initiate_call` (POST: candidate_id → lookup phone → RingOut), `call_status` (GET), `sync_call_logs` (POST, admin only) |
| URLs | `backend/integrations/urls.py` | `/api/integrations/ringcentral/call/`, `/api/integrations/ringcentral/status/`, `/api/integrations/ringcentral/sync/` |
| Celery task | `backend/integrations/tasks.py` | `sync_ringcentral_call_logs` — periodic task to pull logs and create `CallLog` entries |
| Frontend click-to-call | `frontend/src/components/candidates/ClickToCallButton.jsx` (new) | Phone icon button → calls API → shows call status popover |
| Candidate card integration | `frontend/src/pages/FreshCandidatesPage.jsx`, `PipelineCandidatesPage.jsx` | Add click-to-call button on phone number |
| API service | `frontend/src/services/api.js` | Add `integrationsAPI`: `initiateCall`, `callStatus`, `syncCallLogs` |
| Admin settings | `frontend/src/pages/AdminSettingsPage.jsx` | RingCentral credentials configuration section |

### M5.5 — Email Template Management

| Task | Files | Detail |
|---|---|---|
| EmailTemplate model | `backend/interviews/models.py` or `backend/notifications/models.py` | `template_key` (unique, e.g. `interview_confirmation`), `subject_template`, `body_template` (Django template syntax), `is_active`, `updated_by`, `updated_at` |
| Seed templates | Data migration | Create default templates from existing hardcoded strings in `email_service.py` |
| Update EmailService | `backend/interviews/services/email_service.py` | Load template from DB (with cache), render with Django template engine, fallback to hardcoded if not found |
| Admin UI | `frontend/src/pages/AdminSettingsPage.jsx` | "Email Templates" tab with editable template list, preview with variable substitution |
| API endpoints | `backend/interviews/views.py` or new viewset | CRUD for email templates (admin only) |
| API service | `frontend/src/services/api.js` | Add `emailTemplatesAPI`: `list`, `get`, `update`, `preview` |
| Migration | Relevant app migrations | Add EmailTemplate model |

**M5 Deliverables:**
- All API credentials (Zoom, Google, RingCentral) encrypted at rest
- Google Calendar uses Service Account — works on headless servers
- Zoom meetings created/updated/deleted asynchronously with retry
- RingCentral click-to-call from candidate cards
- Call logs auto-synced from RingCentral
- Email templates editable by admin in the UI

---

## Milestone 6: FastGem + KPI + Polish (Days 16-18)

**Goal:** Complete the lifecycle with FastGem upload, add KPI tracking, bulk operations, and reporting enhancements.

### M6.1 — FastGem Upload

| Task | Files | Detail |
|---|---|---|
| Model | `backend/candidates/models.py` | `FastGemUpload`: `candidate` FK (OneToOne or FK), `uploaded_by` FK, `upload_data` JSONField (structured candidate data for FastGem), `status` (pending/uploaded/failed), `external_reference_id` CharField, `error_message` TextField, `created_at` |
| Serializer | `backend/candidates/serializers.py` | `FastGemUploadSerializer`, `FastGemUploadCreateSerializer` |
| ViewSet | `backend/candidates/views.py` | `FastGemUploadViewSet` — create (validates candidate is in `hired` status), list, detail |
| Status auto-update | `backend/candidates/views.py` | On successful FastGem upload → candidate status transitions to `fastgem_uploaded` |
| Frontend page | `frontend/src/pages/FastGemUploadPage.jsx` (new) | Shows candidates with status `hired`, form to enter FastGem data, upload button |
| Route | `frontend/src/App.jsx` | Add `/fastgem` route |
| Sidebar | `frontend/src/components/layout/Sidebar.jsx` | Add "FastGem Upload" under Candidates section (admin only) |
| API service | `frontend/src/services/api.js` | Add `fastgemAPI`: `list`, `create`, `get` |
| Migration | `backend/candidates/migrations/` | Add FastGemUpload model |

### M6.2 — Daily KPI Tracking

| Task | Files | Detail |
|---|---|---|
| User daily target | `backend/accounts/models.py` | Add `daily_call_target` IntegerField (default 0), `daily_booking_target` IntegerField (default 0) |
| KPI report endpoint | `backend/reports/views.py` | `kpi_attainment` endpoint: per-recruiter calls made vs target, bookings made vs target, status changes today |
| KPI global settings | `backend/candidates/models.py` (AppSetting) | Add default KPI targets as AppSetting entries (fallback when per-user target is 0) |
| Dashboard KPI widget | `frontend/src/pages/DashboardPage.jsx` | Add KPI progress bars: calls today (X/target), bookings today (X/target), candidates contacted today |
| Admin KPI config | `frontend/src/pages/AdminSettingsPage.jsx` | "KPI Settings" tab: set global targets, set per-recruiter targets |
| User management | `frontend/src/pages/UserManagementPage.jsx` | Add daily target fields to user create/edit form |
| API service | `frontend/src/services/api.js` | Add `reportsAPI.kpiAttainment` |
| Migration | `backend/accounts/migrations/` | Add daily target fields |

### M6.3 — Bulk Operations

| Task | Files | Detail |
|---|---|---|
| Bulk status update | `backend/candidates/views.py` | `bulk_update_status` action: accepts list of candidate IDs + new status, validates transitions for each, returns success/failure per candidate |
| Bulk reassignment | `backend/candidates/views.py` | `bulk_reassign` action: accepts list of candidate IDs + new recruiter ID |
| Bulk delete (soft) | `backend/candidates/views.py` | `bulk_delete` action: soft-deletes candidates (sets `is_deleted=True`) |
| Soft delete field | `backend/candidates/models.py` | Add `is_deleted` BooleanField (default False), update default manager to exclude deleted |
| Frontend bulk actions | `frontend/src/pages/FreshCandidatesPage.jsx`, `PipelineCandidatesPage.jsx`, `AllCandidatesPage.jsx` | Add checkbox selection on cards/rows, bulk action toolbar (Change Status, Reassign, Delete) |
| API service | `frontend/src/services/api.js` | Add `candidatesAPI.bulkUpdateStatus`, `candidatesAPI.bulkReassign`, `candidatesAPI.bulkDelete` |
| Migration | `backend/candidates/migrations/` | Add is_deleted field |

### M6.4 — Report Enhancements

| Task | Files | Detail |
|---|---|---|
| Booking analytics | `backend/reports/views.py` | `booking_summary`: bookings by location, by date range, conversion rate (bookings → interviews → hires) |
| Round 2 analytics | `backend/reports/views.py` | `round2_summary`: pass/fail rate, average observation scores, trainer performance |
| KPI leaderboard | `backend/reports/views.py` | `recruiter_leaderboard`: daily/weekly/monthly ranking by calls, bookings, hires |
| Frontend charts | `frontend/src/pages/ReportsPage.jsx` | Add new report tabs for booking analytics, Round 2 analytics, KPI leaderboard |
| API service | `frontend/src/services/api.js` | Add new report endpoints to `reportsAPI` |

### M6.5 — Miscellaneous Polish

| Task | Files | Detail |
|---|---|---|
| Rate limiting | `backend/ats_project/settings.py` | Configure DRF throttling: `'anon': '5/min'` for login, `'user': '100/min'` for authenticated |
| Security headers | `backend/ats_project/settings.py` | Enable `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS` (behind env flag for dev) |
| Phone validation | `backend/requirements.txt`, serializers | Add `phonenumbers` library; validate phone format in CandidateCreateSerializer |
| Pagination upgrade | `backend/ats_project/settings.py` | Switch to `CursorPagination` for candidate list endpoints |
| Django admin | All `admin.py` files | Register all new models with meaningful list_display, list_filter, search_fields |
| Docker Compose | `docker-compose.yml` (new or update) | Add Redis, Celery worker, Celery Beat services |

**M6 Deliverables:**
- FastGem upload page for candidates with `hired` status
- Daily KPI dashboard with progress bars and targets
- Bulk status update, reassignment, and soft delete
- Enhanced reports: booking analytics, Round 2 metrics, KPI leaderboard
- Production security hardening (rate limits, headers, phone validation)
- Docker Compose configuration for full stack

---

## Summary: New Files Created Across All Milestones

```
backend/
├── ats_project/celery.py                          (M1)
├── ats_project/asgi.py                            (M4, update)
├── core/permissions.py                            (M1)
├── core/encryption.py                             (M1)
├── bookings/                                      (M2)
│   ├── models.py, serializers.py, views.py
│   ├── urls.py, admin.py, tasks.py
│   └── migrations/
├── notifications/                                 (M4)
│   ├── models.py, serializers.py, views.py
│   ├── urls.py, services.py, tasks.py
│   ├── consumers.py, routing.py, middleware.py
│   └── migrations/
├── integrations/                                  (M5)
│   ├── models.py, views.py, urls.py, admin.py
│   ├── services/ringcentral_service.py
│   ├── tasks.py
│   └── migrations/
└── interviews/tasks.py                            (M1)

frontend/src/
├── pages/
│   ├── ForgotPasswordPage.jsx                     (M1)
│   ├── ResetPasswordPage.jsx                      (M1)
│   ├── ObservationPage.jsx                        (M3)
│   └── FastGemUploadPage.jsx                      (M6)
├── components/
│   ├── common/
│   │   ├── ErrorBoundary.jsx                      (M1)
│   │   └── Toast.jsx                              (M4)
│   ├── bookings/
│   │   └── BookCandidateModal.jsx                 (M2)
│   ├── candidates/
│   │   └── ClickToCallButton.jsx                  (M5)
│   └── layout/
│       ├── NotificationBell.jsx                   (M4)
│       └── NotificationPanel.jsx                  (M4)
└── hooks/
    └── useNotifications.js                        (M4)
```

## Summary: Models Added/Modified

| Model | Action | Milestone |
|---|---|---|
| `User` | Modified (new roles, daily targets) | M1, M6 |
| `Candidate` | Modified (new fields, soft delete, trainer FK) | M3, M6 |
| `Interview` | Modified (round, booking FK, slot FK) | M2 |
| `InterviewSlot` | Modified (round_type) | M2 |
| `Booking` | **New** | M2 |
| `BookingActivityLog` | **New** | M2 |
| `InterviewFeedback` | **New** | M3 |
| `ObservationSheet` | **New** | M3 |
| `Notification` | **New** | M4 |
| `NotificationPreference` | **New** | M4 |
| `IntegrationCredential` | **New** | M5 |
| `EmailTemplate` | **New** | M5 |
| `FastGemUpload` | **New** | M6 |

---

**Awaiting your approval to begin Milestone 1 implementation.**
