import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger('ats')


@shared_task(bind=True, max_retries=3, autoretry_for=(Exception,), retry_backoff=True)
def send_notification_email(self, notification_id):
    from .models import Notification
    try:
        notification = Notification.objects.select_related('recipient').get(id=notification_id)
    except Notification.DoesNotExist:
        logger.warning(f'Notification {notification_id} not found for email')
        return

    subject = f'[ATS] {notification.title}'
    body = notification.message
    if notification.link:
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        body += f'\n\nView details: {frontend_url}{notification.link}'

    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [notification.recipient.email],
            fail_silently=False,
        )
        logger.info(f'Notification email sent to {notification.recipient.email}')
    except Exception as exc:
        logger.error(f'Failed to send notification email: {exc}')
        raise


@shared_task
def send_follow_up_reminders():
    from candidates.models import Candidate
    from .services import NotificationService

    today = timezone.now().date()
    candidates = Candidate.objects.filter(
        follow_up_date=today,
        assigned_recruiter__isnull=False,
    ).select_related('assigned_recruiter')

    count = 0
    for candidate in candidates:
        NotificationService.notify_and_email(
            recipient=candidate.assigned_recruiter,
            title='Follow-up due today',
            message=f'Follow-up is due for {candidate.full_name} ({candidate.phone or candidate.email}).',
            event_type='assignment',
            category='action',
            link=f'/candidates/{candidate.id}',
        )
        count += 1

    logger.info(f'Sent {count} follow-up reminders for {today}')
    return count


@shared_task
def send_interview_reminders():
    from interviews.models import Interview
    from .services import NotificationService
    from datetime import timedelta

    tomorrow = timezone.now().date() + timedelta(days=1)
    interviews = Interview.objects.filter(
        scheduled_at__date=tomorrow,
        status='scheduled',
    ).select_related('candidate', 'candidate__assigned_recruiter')

    count = 0
    for interview in interviews:
        recruiter = interview.candidate.assigned_recruiter
        if recruiter:
            NotificationService.notify_and_email(
                recipient=recruiter,
                title='Interview tomorrow',
                message=f'Interview for {interview.candidate.full_name} is scheduled for tomorrow at {interview.scheduled_at.strftime("%H:%M")}.',
                event_type='interview',
                category='info',
                link=f'/candidates/{interview.candidate.id}',
            )
            count += 1

    logger.info(f'Sent {count} interview reminders for {tomorrow}')
    return count
