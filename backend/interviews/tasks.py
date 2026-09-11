import logging
from celery import shared_task

logger = logging.getLogger('ats')


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_interview_confirmation_email(self, interview_id):
    from .models import Interview
    from .services.email_service import EmailService
    interview = Interview.objects.select_related('candidate', 'zoom_account').get(id=interview_id)
    EmailService.send_interview_confirmation(interview)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_interview_cancellation_email(self, interview_id):
    from .models import Interview
    from .services.email_service import EmailService
    interview = Interview.objects.select_related('candidate', 'zoom_account').get(id=interview_id)
    EmailService.send_interview_cancellation(interview)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_interview_reschedule_email(self, interview_id):
    from .models import Interview
    from .services.email_service import EmailService
    interview = Interview.objects.select_related('candidate', 'zoom_account').get(id=interview_id)
    EmailService.send_interview_reschedule(interview)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_interview_reminder_email(self, interview_id):
    from .models import Interview
    from .services.email_service import EmailService
    interview = Interview.objects.select_related('candidate', 'zoom_account').get(id=interview_id)
    EmailService.send_interview_reminder(interview)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def create_zoom_meeting_task(self, interview_id):
    from .models import Interview
    from .services.zoom_service import ZoomService
    from candidates.models import CandidateActivityLog
    from candidates.constants import ACTION_ZOOM_MEETING_CREATED

    interview = Interview.objects.select_related('candidate', 'zoom_account').get(id=interview_id)
    zoom_account = interview.zoom_account or ZoomService.get_next_available_room()
    zoom_data = ZoomService.create_meeting(
        topic=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
        start_time=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        agenda=interview.notes,
        zoom_account=zoom_account,
    )
    if zoom_data:
        interview.zoom_meeting_id = zoom_data['meeting_id']
        interview.zoom_join_url = zoom_data['join_url']
        interview.zoom_start_url = zoom_data['start_url']
        interview.zoom_account = zoom_data.get('zoom_account')
        interview.save(update_fields=[
            'zoom_meeting_id', 'zoom_join_url', 'zoom_start_url', 'zoom_account',
        ])
        CandidateActivityLog.objects.create(
            candidate=interview.candidate,
            action_type=ACTION_ZOOM_MEETING_CREATED,
            new_value=zoom_data['join_url'],
            performed_by=interview.created_by,
        )


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def create_calendar_event_task(self, interview_id):
    from .models import Interview
    from .services.calendar_service import GoogleCalendarService
    from candidates.models import CandidateActivityLog
    from candidates.constants import ACTION_CALENDAR_EVENT_CREATED

    interview = Interview.objects.select_related('candidate').get(id=interview_id)
    attendees = [interview.candidate.email, interview.interviewer_email]
    event_id = GoogleCalendarService.create_event(
        summary=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
        description=interview.notes,
        start_time=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        attendees=attendees,
    )
    if event_id:
        interview.google_event_id = event_id
        interview.save(update_fields=['google_event_id'])
        CandidateActivityLog.objects.create(
            candidate=interview.candidate,
            action_type=ACTION_CALENDAR_EVENT_CREATED,
            new_value=event_id,
            performed_by=interview.created_by,
        )


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def update_zoom_meeting_task(self, interview_id):
    from .models import Interview
    from .services.zoom_service import ZoomService

    interview = Interview.objects.select_related('candidate', 'zoom_account').get(id=interview_id)
    if interview.zoom_meeting_id:
        ZoomService.update_meeting(
            meeting_id=interview.zoom_meeting_id,
            topic=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
            start_time=interview.scheduled_at,
            duration_minutes=interview.duration_minutes,
            zoom_account=interview.zoom_account,
        )


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def update_calendar_event_task(self, interview_id):
    from .models import Interview
    from .services.calendar_service import GoogleCalendarService

    interview = Interview.objects.select_related('candidate').get(id=interview_id)
    if interview.google_event_id:
        GoogleCalendarService.update_event(
            event_id=interview.google_event_id,
            summary=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
            start_time=interview.scheduled_at,
            duration_minutes=interview.duration_minutes,
        )


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def delete_zoom_meeting_task(self, meeting_id, zoom_account_id=None):
    from .models import ZoomAccount
    from .services.zoom_service import ZoomService

    zoom_account = None
    if zoom_account_id:
        try:
            zoom_account = ZoomAccount.objects.get(id=zoom_account_id)
        except ZoomAccount.DoesNotExist:
            pass
    ZoomService.delete_meeting(meeting_id, zoom_account=zoom_account)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def delete_calendar_event_task(self, event_id):
    from .services.calendar_service import GoogleCalendarService
    GoogleCalendarService.delete_event(event_id)


@shared_task
def send_upcoming_reminders():
    from django.utils import timezone
    from datetime import timedelta
    from .models import Interview

    now = timezone.now()
    window_start = now + timedelta(minutes=25)
    window_end = now + timedelta(minutes=35)

    interviews = Interview.objects.filter(
        status='scheduled',
        scheduled_at__gte=window_start,
        scheduled_at__lte=window_end,
    ).select_related('candidate')

    for interview in interviews:
        send_interview_reminder_email.delay(interview.id)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def send_generic_email(self, recipient, subject, body, candidate_id=None, email_type='general', sent_by_id=None):
    from .services.email_service import EmailService
    from candidates.models import Candidate
    from accounts.models import User

    candidate = Candidate.objects.get(id=candidate_id) if candidate_id else None
    sent_by = User.objects.get(id=sent_by_id) if sent_by_id else None
    EmailService.send_email(
        recipient=recipient,
        subject=subject,
        body=body,
        candidate=candidate,
        email_type=email_type,
        sent_by=sent_by,
    )
