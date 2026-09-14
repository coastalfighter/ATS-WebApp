"""
Firebase → Django ATS migration command.

Reads exported Firebase JSON files and imports them into the Django database,
mapping Firebase's denormalized document structure to the normalized relational schema.

Order of operations:
  1. Users (accounts.User)
  2. Locations (interviews.Location)
  3. ZoomAccounts (interviews.ZoomAccount)
  4. HiringManagers → Users with role=hiring_manager
  5. Leads → Candidates (bucket=fresh)
  6. Candidates → Candidates (bucket=pipeline)
  7. Slots → InterviewSlots
  8. Bookings → Bookings
  9. Observations (stored as candidate notes)
  10. Settings → AppSetting
  11. EmailTemplates → AppSetting
"""

import json
import os
from datetime import datetime, date, time, timezone as tz
from django.core.management.base import BaseCommand
from django.db import transaction

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'migration_data')


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return {}
    with open(path, 'r') as f:
        return json.load(f)


def firebase_ts_to_datetime(ts_obj):
    if not ts_obj or not isinstance(ts_obj, dict):
        return None
    seconds = ts_obj.get('_seconds')
    if seconds is None:
        return None
    return datetime.fromtimestamp(seconds, tz=tz.utc)


def firebase_ts_to_date(ts_obj):
    dt = firebase_ts_to_datetime(ts_obj)
    return dt.date() if dt else None


def split_name(full_name):
    if not full_name:
        return '', ''
    parts = full_name.strip().split(None, 1)
    first = parts[0] if parts else ''
    last = parts[1] if len(parts) > 1 else ''
    return first[:100], last[:100]


def clean_phone(phone):
    if not phone:
        return ''
    digits = ''.join(c for c in str(phone) if c.isdigit() or c == '+')
    return digits[:20]


def clean_email(email):
    if not email:
        return ''
    return email.strip().lower()[:254]


def map_firebase_role(role_str):
    role_map = {
        'super admin': 'admin',
        'admin': 'admin',
        'subadmin': 'subadmin',
        'recruiter': 'recruiter',
        'hiring manager': 'hiring_manager',
        'trainer': 'trainer',
    }
    return role_map.get((role_str or '').strip().lower(), 'recruiter')


def map_candidate_status(fb_status, fb_stage):
    """Map Firebase status/stage to Django current_status."""
    status_lower = (fb_status or '').strip().lower()
    stage_lower = (fb_stage or '').strip().lower()

    status_map = {
        'pending': 'interested',
        'scheduled': 'screening_scheduled',
        'booked': 'screening_scheduled',
        'completed': 'screening_completed',
        'show': 'screening_completed',
        'no show': 'screening_completed',
        'no-show': 'screening_completed',
        'cancelled': 'screening_completed',
        'observation': 'observation',
        'selected for observation': 'observation',
        'training': 'training',
        'training completed': 'training_completed',
        'rejected': 'rejected',
        'selected': 'selected',
        'hired': 'hired',
        'joined': 'joined',
        'dropped': 'dropped',
        'offer released': 'offer_released',
        'submitted': 'submitted',
        'fastgem uploaded': 'fastgem_uploaded',
    }

    if status_lower in status_map:
        return 'pipeline', status_map[status_lower]

    stage_map = {
        'observation': ('pipeline', 'observation'),
        'training': ('pipeline', 'training'),
        'completed': ('pipeline', 'screening_completed'),
        'scheduled': ('pipeline', 'screening_scheduled'),
        'pending': ('pipeline', 'interested'),
    }
    if stage_lower in stage_map:
        return stage_map[stage_lower]

    return 'pipeline', 'interested'


def map_lead_status(fb_status, call_status):
    """Map Firebase lead status to Django fresh candidate status."""
    status_lower = (fb_status or '').strip().lower()
    call_lower = (call_status or '').strip().lower()

    if 'booking' in status_lower:
        return 'pipeline', 'interested'

    call_map = {
        'not interested': 'not_interested',
        'wrong number': 'wrong_number',
        'invalid': 'invalid_contact',
        'do not contact': 'do_not_contact',
        'duplicate': 'duplicate',
        'callback later': 'asked_to_connect_later',
        'follow up': 'follow_up_due',
        'interested': 'interested',
        'contacted': 'contacted',
        'unanswered': 'unanswered',
        'no answer': 'unanswered',
        'voicemail': 'unanswered',
        'vm': 'unanswered',
    }
    for key, val in call_map.items():
        if key in call_lower:
            if val == 'interested':
                return 'pipeline', 'interested'
            return 'fresh', val

    status_map = {
        'new': 'never_contacted',
        'fresh': 'never_contacted',
        'locked': 'contacted',
        'called': 'contacted',
        'contacted': 'contacted',
        'closed': 'not_interested',
    }
    for key, val in status_map.items():
        if key in status_lower:
            return 'fresh', val

    return 'fresh', 'never_contacted'


def map_slot_status(fb_status):
    status_lower = (fb_status or '').strip().lower()
    status_map = {
        'available': 'open',
        'open': 'open',
        'partially booked': 'partially_booked',
        'fully booked': 'fully_booked',
        'cancelled': 'cancelled',
        'closed': 'cancelled',
    }
    return status_map.get(status_lower, 'open')


def map_booking_status(fb_status):
    status_lower = (fb_status or '').strip().lower()
    if 'cancel' in status_lower:
        return 'cancelled'
    if 'no' in status_lower and 'show' in status_lower:
        return 'no_show'
    if 'complet' in status_lower or 'show' == status_lower:
        return 'confirmed'
    if 'confirm' in status_lower:
        return 'confirmed'
    return 'pending'


def parse_time(time_str):
    if not time_str:
        return None
    try:
        parts = time_str.strip().split(':')
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except ValueError:
        return None


class Command(BaseCommand):
    help = 'Migrate data from Firebase JSON exports to Django database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Parse and validate data without writing to the database',
        )
        parser.add_argument(
            '--data-dir', type=str, default=DATA_DIR,
            help='Path to directory containing Firebase JSON exports',
        )

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        self.data_dir = options['data_dir']
        global DATA_DIR
        DATA_DIR = self.data_dir

        self.fb_user_uid_to_django_id = {}
        self.fb_recruiter_docid_to_uid = {}
        self.fb_location_id_to_django_id = {}
        self.fb_zoom_id_to_django_id = {}
        self.fb_hm_docid_to_django_id = {}
        self.fb_candidate_id_to_django_id = {}
        self.fb_slot_id_to_django_id = {}
        self.fb_booking_id_to_django_id = {}

        self.stats = {}

        if self.dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no data will be written'))

        try:
            with transaction.atomic():
                self._migrate_users()
                self._migrate_locations()
                self._migrate_zoom_accounts()
                self._migrate_hiring_managers()
                self._migrate_leads()
                self._migrate_candidates()
                self._migrate_slots()
                self._migrate_bookings()
                self._migrate_observations()
                self._migrate_settings()
                self._migrate_email_templates()

                if self.dry_run:
                    raise DryRunAbort()

        except DryRunAbort:
            self.stdout.write(self.style.WARNING('\nDry run complete — rolled back.'))

        self.stdout.write(self.style.SUCCESS('\n=== Migration Summary ==='))
        for table, counts in self.stats.items():
            self.stdout.write(f"  {table}: {counts.get('created', 0)} created, "
                              f"{counts.get('skipped', 0)} skipped, "
                              f"{counts.get('errors', 0)} errors")

    def _stat(self, table, key):
        self.stats.setdefault(table, {'created': 0, 'skipped': 0, 'errors': 0})
        self.stats[table][key] = self.stats[table].get(key, 0) + 1

    def _migrate_users(self):
        from accounts.models import User
        self.stdout.write('\n--- Migrating Users ---')
        data = load_json('users.json')
        recruiters = load_json('recruiters.json')

        for doc_id, rec_data in recruiters.items():
            uid = rec_data.get('uid', '')
            if uid:
                self.fb_recruiter_docid_to_uid[doc_id] = uid

        for uid, u in data.items():
            email = clean_email(u.get('email', ''))
            if not email:
                self._stat('User', 'skipped')
                continue

            first, last = split_name(u.get('name', ''))
            role = map_firebase_role(u.get('role', 'Recruiter'))
            phone = clean_phone(u.get('phone', ''))

            existing = User.objects.filter(email=email).first()
            if existing:
                self.fb_user_uid_to_django_id[uid] = existing.id
                self._stat('User', 'skipped')
                self.stdout.write(f"  User {email} already exists (id={existing.id})")
                continue

            user = User(
                username=email,
                email=email,
                first_name=first,
                last_name=last,
                role=role,
                phone=phone,
                is_active=u.get('active', True),
            )
            user.set_password('ChangeMeNow2026!')
            user.save()

            self.fb_user_uid_to_django_id[uid] = user.id
            self._stat('User', 'created')
            self.stdout.write(f"  Created user: {email} (role={role}, id={user.id})")

        self.stdout.write(f"  UID map has {len(self.fb_user_uid_to_django_id)} entries")

    def _migrate_locations(self):
        from interviews.models import Location
        self.stdout.write('\n--- Migrating Locations ---')
        data = load_json('locations.json')

        for doc_id, loc in data.items():
            name = (loc.get('name') or '').strip()
            if not name:
                self._stat('Location', 'skipped')
                continue

            existing = Location.objects.filter(name=name).first()
            if existing:
                self.fb_location_id_to_django_id[doc_id] = existing.id
                self._stat('Location', 'skipped')
                continue

            obj = Location.objects.create(
                name=name,
                address=name,
                city=name.split(',')[0].strip() if ',' in name else name,
                state=name.split(',')[1].strip() if ',' in name else '',
                country='USA',
                latitude=0,
                longitude=0,
                is_active=loc.get('active', True),
            )
            self.fb_location_id_to_django_id[doc_id] = obj.id
            self._stat('Location', 'created')
            self.stdout.write(f"  Created location: {name} (id={obj.id})")

    def _migrate_zoom_accounts(self):
        from interviews.models import ZoomAccount
        self.stdout.write('\n--- Migrating Zoom Accounts ---')
        data = load_json('zoomRooms.json')

        for doc_id, z in data.items():
            name = z.get('name', doc_id)
            email = z.get('email', '')
            meeting_url = z.get('meetingUrl', '')

            existing = ZoomAccount.objects.filter(room_name=name).first()
            if existing:
                self.fb_zoom_id_to_django_id[doc_id] = existing.id
                zoom_no = z.get('roomNo')
                if zoom_no:
                    self.fb_zoom_id_to_django_id[f"room_{zoom_no}"] = existing.id
                self._stat('ZoomAccount', 'skipped')
                continue

            obj = ZoomAccount.objects.create(
                room_name=name,
                account_id=email,
                client_id=z.get('meetingId', ''),
                client_secret='',
                is_active=z.get('active', True),
            )
            self.fb_zoom_id_to_django_id[doc_id] = obj.id
            zoom_no = z.get('roomNo')
            if zoom_no:
                self.fb_zoom_id_to_django_id[f"room_{zoom_no}"] = obj.id
            self._stat('ZoomAccount', 'created')
            self.stdout.write(f"  Created zoom: {name} (id={obj.id})")

    def _migrate_hiring_managers(self):
        from accounts.models import User
        self.stdout.write('\n--- Migrating Hiring Managers ---')
        data = load_json('hiringManagers.json')

        for doc_id, hm in data.items():
            name = (hm.get('name') or '').strip()
            email = clean_email(hm.get('email', ''))
            if not email and not name:
                self._stat('HiringManager', 'skipped')
                continue

            if email:
                existing = User.objects.filter(email=email).first()
            else:
                existing = None

            if existing:
                if existing.role not in ('admin', 'subadmin', 'hiring_manager'):
                    existing.role = 'hiring_manager'
                    existing.save(update_fields=['role'])
                self.fb_hm_docid_to_django_id[doc_id] = existing.id
                self._stat('HiringManager', 'skipped')
                self.stdout.write(f"  HM {name} ({email}) mapped to existing user id={existing.id}")
                continue

            first, last = split_name(name)
            username = email or f"hm_{doc_id[:8]}"
            user = User(
                username=username,
                email=email or f"hm_{doc_id[:8]}@placeholder.local",
                first_name=first,
                last_name=last,
                role='hiring_manager',
                is_active=hm.get('active', True),
            )
            user.set_password('ChangeMeNow2026!')
            user.save()

            self.fb_hm_docid_to_django_id[doc_id] = user.id
            self._stat('HiringManager', 'created')
            self.stdout.write(f"  Created HM user: {name} ({email}, id={user.id})")

    def _migrate_leads(self):
        from candidates.models import Candidate
        self.stdout.write('\n--- Migrating Leads (as Fresh Candidates) ---')
        data = load_json('leads.json')
        created = 0
        skipped = 0
        errors = 0

        for doc_id, lead in data.items():
            try:
                name = (lead.get('name') or '').strip()
                if not name:
                    skipped += 1
                    continue

                has_empty_cols = any(k.startswith('__EMPTY') for k in lead.keys())
                if has_empty_cols:
                    name = name or (lead.get('Name') or '').strip()
                    email_raw = lead.get('email') or lead.get('Email') or ''
                    phone_raw = lead.get('phone') or lead.get('Phone') or ''
                    source_raw = lead.get('source') or lead.get('Source') or ''
                    job_market_raw = lead.get('jobMarket') or lead.get('Job Market') or ''
                else:
                    email_raw = lead.get('email', '')
                    phone_raw = lead.get('phone', '')
                    source_raw = lead.get('source', '')
                    job_market_raw = lead.get('jobMarket') or lead.get('jobMarketName') or ''

                first, last = split_name(name)
                email = clean_email(email_raw)
                phone = clean_phone(phone_raw)

                if not phone and not email:
                    skipped += 1
                    continue

                fb_status = lead.get('status', '')
                call_status = lead.get('callStatus', '')
                bucket, status = map_lead_status(fb_status, call_status)

                if bucket == 'pipeline' and lead.get('bookingCandidateId'):
                    skipped += 1
                    continue

                recruiter_uid = lead.get('lockedByUid') or lead.get('lastCalledBy') or ''
                recruiter_id = self.fb_user_uid_to_django_id.get(recruiter_uid)

                created_at = firebase_ts_to_datetime(lead.get('createdAt'))

                obj = Candidate(
                    first_name=first,
                    last_name=last,
                    email=email,
                    phone=phone,
                    source=str(source_raw)[:100],
                    residential_location=(lead.get('residentialLocation') or '')[:200],
                    job_market=str(job_market_raw)[:200],
                    current_bucket=bucket,
                    current_status=status,
                    assigned_recruiter_id=recruiter_id,
                    notes=(lead.get('notes') or '')[:5000],
                )
                obj.save()

                if created_at:
                    Candidate.objects.filter(pk=obj.pk).update(created_at=created_at)

                self.fb_candidate_id_to_django_id[doc_id] = obj.id
                created += 1

            except Exception as e:
                errors += 1
                self.stderr.write(f"  Error on lead {doc_id}: {e}")

        self.stats['Lead→Candidate'] = {'created': created, 'skipped': skipped, 'errors': errors}
        self.stdout.write(f"  Leads: {created} created, {skipped} skipped, {errors} errors")

    def _migrate_candidates(self):
        from candidates.models import Candidate
        self.stdout.write('\n--- Migrating Candidates (Pipeline) ---')
        data = load_json('candidates.json')
        created = 0
        skipped = 0
        errors = 0

        for doc_id, c in data.items():
            try:
                name = (c.get('name') or '').strip()
                if not name:
                    skipped += 1
                    continue

                first, last = split_name(name)
                email = clean_email(c.get('email', ''))
                phone = clean_phone(c.get('phone', ''))

                if not phone and not email:
                    skipped += 1
                    continue

                fb_status = c.get('status') or c.get('currentStage') or ''
                fb_stage = c.get('currentStage') or ''
                bucket, status = map_candidate_status(fb_status, fb_stage)

                recruiter_uid = c.get('recruiterUid', '')
                recruiter_id = self.fb_user_uid_to_django_id.get(recruiter_uid)

                created_at = firebase_ts_to_datetime(c.get('createdAt'))
                notes = (c.get('notes') or '')[:5000]

                obj = Candidate(
                    first_name=first,
                    last_name=last,
                    email=email,
                    phone=phone,
                    source=(c.get('source') or '')[:100],
                    residential_location=(c.get('residentialLocation') or '')[:200],
                    job_market=(c.get('jobMarket') or c.get('jobMarketName') or '')[:200],
                    current_bucket=bucket,
                    current_status=status,
                    assigned_recruiter_id=recruiter_id,
                    notes=notes,
                )
                obj.save()

                if created_at:
                    Candidate.objects.filter(pk=obj.pk).update(created_at=created_at)

                self.fb_candidate_id_to_django_id[doc_id] = obj.id
                created += 1

            except Exception as e:
                errors += 1
                self.stderr.write(f"  Error on candidate {doc_id}: {e}")

        self.stats['Candidate'] = {'created': created, 'skipped': skipped, 'errors': errors}
        self.stdout.write(f"  Candidates: {created} created, {skipped} skipped, {errors} errors")

    def _migrate_slots(self):
        from interviews.models import InterviewSlot
        self.stdout.write('\n--- Migrating Slots ---')
        data = load_json('slots.json')
        created = 0
        skipped = 0
        errors = 0

        for doc_id, s in data.items():
            try:
                slot_date = parse_date(s.get('date', ''))
                start = parse_time(s.get('startTime', ''))
                end = parse_time(s.get('endTime', ''))

                if not slot_date or not start or not end:
                    skipped += 1
                    continue

                location_id = self.fb_location_id_to_django_id.get(s.get('locationId'))
                if not location_id:
                    skipped += 1
                    self.stderr.write(f"  Slot {doc_id}: location {s.get('locationId')} not found")
                    continue

                hm_id = self.fb_hm_docid_to_django_id.get(s.get('hmId'))
                if not hm_id:
                    skipped += 1
                    self.stderr.write(f"  Slot {doc_id}: HM {s.get('hmId')} not found")
                    continue

                zoom_id = None
                zoom_room_no = s.get('zoomRoomNo')
                if zoom_room_no:
                    zoom_id = self.fb_zoom_id_to_django_id.get(f"room_{zoom_room_no}")

                status = map_slot_status(s.get('status', ''))
                meeting_link = (s.get('meetingUrl') or s.get('zoomMeetingUrl') or '')[:2048]

                obj = InterviewSlot.objects.create(
                    location_id=location_id,
                    hiring_manager_id=hm_id,
                    date=slot_date,
                    start_time=start,
                    end_time=end,
                    max_capacity=s.get('maxCapacity', 1),
                    booked_count=s.get('currentBookings', 0),
                    meeting_link=meeting_link,
                    zoom_account_id=zoom_id,
                    round_type='round_1',
                    status=status,
                )

                self.fb_slot_id_to_django_id[doc_id] = obj.id
                created += 1

            except Exception as e:
                errors += 1
                self.stderr.write(f"  Error on slot {doc_id}: {e}")

        self.stats['InterviewSlot'] = {'created': created, 'skipped': skipped, 'errors': errors}
        self.stdout.write(f"  Slots: {created} created, {skipped} skipped, {errors} errors")

    def _migrate_bookings(self):
        from bookings.models import Booking
        self.stdout.write('\n--- Migrating Bookings ---')
        data = load_json('bookings.json')
        created = 0
        skipped = 0
        errors = 0

        for doc_id, b in data.items():
            try:
                candidate_id = self.fb_candidate_id_to_django_id.get(b.get('candidateId'))
                slot_id = self.fb_slot_id_to_django_id.get(b.get('slotId'))

                if not candidate_id or not slot_id:
                    skipped += 1
                    continue

                recruiter_uid = b.get('recruiterUid', '')
                booked_by_id = self.fb_user_uid_to_django_id.get(recruiter_uid)

                status = map_booking_status(b.get('status', ''))
                round_val = 'round_2' if b.get('interviewRound') == 2 else 'round_1'

                created_at = firebase_ts_to_datetime(b.get('createdAt'))

                obj = Booking(
                    candidate_id=candidate_id,
                    interview_slot_id=slot_id,
                    booked_by_id=booked_by_id,
                    status=status,
                    round=round_val,
                )
                obj.save()

                if created_at:
                    Booking.objects.filter(pk=obj.pk).update(created_at=created_at)

                self.fb_booking_id_to_django_id[doc_id] = obj.id
                created += 1

            except Exception as e:
                errors += 1
                self.stderr.write(f"  Error on booking {doc_id}: {e}")

        self.stats['Booking'] = {'created': created, 'skipped': skipped, 'errors': errors}
        self.stdout.write(f"  Bookings: {created} created, {skipped} skipped, {errors} errors")

    def _migrate_observations(self):
        from candidates.models import CandidateNote
        self.stdout.write('\n--- Migrating Observations (as Candidate Notes) ---')
        data = load_json('observations.json')
        created = 0
        skipped = 0

        for doc_id, obs in data.items():
            candidate_id = self.fb_candidate_id_to_django_id.get(obs.get('candidateId'))
            if not candidate_id:
                skipped += 1
                continue

            feedback = obs.get('feedback', '')
            source = obs.get('source', '')
            round_num = obs.get('round', '')
            status = obs.get('status', '')

            note_text = f"[Observation] Round: {round_num} | Status: {status} | Source: {source}\n{feedback}"

            CandidateNote.objects.create(
                candidate_id=candidate_id,
                note=note_text,
            )
            created += 1

        self.stats['Observation→Note'] = {'created': created, 'skipped': skipped, 'errors': 0}
        self.stdout.write(f"  Observations: {created} created, {skipped} skipped")

    def _migrate_settings(self):
        from candidates.models import AppSetting
        self.stdout.write('\n--- Migrating Settings ---')
        data = load_json('settings.json')
        created = 0

        for key, val in data.items():
            if isinstance(val, dict):
                for sub_key, sub_val in val.items():
                    if sub_key in ('updatedAt', 'createdAt'):
                        continue
                    setting_key = f"{key}.{sub_key}"
                    setting_val = json.dumps(sub_val) if isinstance(sub_val, (dict, list)) else str(sub_val)
                    AppSetting.objects.update_or_create(
                        key=setting_key,
                        defaults={'value': setting_val, 'description': f'Migrated from Firebase {key}.{sub_key}'},
                    )
                    created += 1

        self.stats['AppSetting'] = {'created': created, 'skipped': 0, 'errors': 0}
        self.stdout.write(f"  Settings: {created} created")

    def _migrate_email_templates(self):
        from candidates.models import AppSetting
        self.stdout.write('\n--- Migrating Email Templates ---')
        data = load_json('emailTemplates.json')
        created = 0

        for key, tpl in data.items():
            tpl_data = {
                'subject': tpl.get('subject', ''),
                'body': tpl.get('body', ''),
                'name': tpl.get('name', key),
                'active': tpl.get('active', True),
            }
            AppSetting.objects.update_or_create(
                key=f"email_template.{key}",
                defaults={
                    'value': json.dumps(tpl_data),
                    'description': f'Email template: {tpl.get("name", key)}',
                },
            )
            created += 1

        self.stats['EmailTemplate'] = {'created': created, 'skipped': 0, 'errors': 0}
        self.stdout.write(f"  Email templates: {created} created")


class DryRunAbort(Exception):
    pass
