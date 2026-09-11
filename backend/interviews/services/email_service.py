import logging
from django.core.mail import send_mail
from django.conf import settings
from interviews.models import EmailLog

logger = logging.getLogger('ats')

TEMPLATES = {
    'interview_confirmation': {
        'subject': 'Interview Scheduled - {interview_type}',
        'body': (
            'Dear {candidate_name},\n\n'
            'Your {interview_type} interview has been scheduled.\n\n'
            'Date & Time: {scheduled_at}\n'
            'Duration: {duration} minutes\n'
            'Interviewer: {interviewer_name}\n'
            '{zoom_info}\n'
            'Please be on time and prepared.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    'interview_cancellation': {
        'subject': 'Interview Cancelled - {interview_type}',
        'body': (
            'Dear {candidate_name},\n\n'
            'We regret to inform you that your {interview_type} interview '
            'scheduled for {scheduled_at} has been cancelled.\n\n'
            'Our team will reach out to reschedule if applicable.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    'interview_reschedule': {
        'subject': 'Interview Rescheduled - {interview_type}',
        'body': (
            'Dear {candidate_name},\n\n'
            'Your {interview_type} interview has been rescheduled.\n\n'
            'New Date & Time: {scheduled_at}\n'
            'Duration: {duration} minutes\n'
            'Interviewer: {interviewer_name}\n'
            '{zoom_info}\n'
            'Please update your calendar accordingly.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    'interview_reminder': {
        'subject': 'Reminder: {interview_type} Interview Tomorrow',
        'body': (
            'Dear {candidate_name},\n\n'
            'This is a reminder that your {interview_type} interview is scheduled for tomorrow.\n\n'
            'Date & Time: {scheduled_at}\n'
            'Interviewer: {interviewer_name}\n'
            '{zoom_info}\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    'interviewer_notification': {
        'subject': 'Interview Scheduled with {candidate_name}',
        'body': (
            'Dear {interviewer_name},\n\n'
            'An interview has been scheduled with {candidate_name}.\n\n'
            'Type: {interview_type}\n'
            'Date & Time: {scheduled_at}\n'
            'Duration: {duration} minutes\n'
            '{zoom_info}\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    'interviewer_cancellation': {
        'subject': 'Interview Cancelled with {candidate_name}',
        'body': (
            'Dear {interviewer_name},\n\n'
            'The {interview_type} interview with {candidate_name} '
            'scheduled for {scheduled_at} has been cancelled.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
}


def _get_template(key):
    try:
        from integrations.models import EmailTemplate
        tpl = EmailTemplate.objects.filter(template_key=key, is_active=True).first()
        if tpl:
            return {'subject': tpl.subject_template, 'body': tpl.body_template}
    except Exception:
        pass
    return TEMPLATES.get(key)


class EmailService:

    @classmethod
    def send_email(cls, recipient, subject, body, interview=None, candidate=None, email_type='general', sent_by=None):
        log = EmailLog(
            interview=interview,
            candidate=candidate,
            email_type=email_type,
            recipient=recipient,
            subject=subject,
            body=body,
            sent_by=sent_by,
        )
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )
            log.status = 'sent'
        except Exception as e:
            logger.exception(f'Failed to send email to {recipient}: {e}')
            log.status = 'failed'
            log.error_message = str(e)
        log.save()
        return log

    @classmethod
    def _format_zoom_info(cls, interview):
        if interview.zoom_join_url:
            return f'Zoom Meeting Link: {interview.zoom_join_url}'
        return ''

    @classmethod
    def _build_context(cls, interview):
        return {
            'candidate_name': interview.candidate.full_name,
            'interview_type': interview.get_interview_type_display(),
            'scheduled_at': interview.scheduled_at.strftime('%B %d, %Y at %I:%M %p UTC'),
            'duration': interview.duration_minutes,
            'interviewer_name': interview.interviewer_name,
            'zoom_info': cls._format_zoom_info(interview),
        }

    @classmethod
    def send_interview_confirmation(cls, interview, sent_by=None):
        ctx = cls._build_context(interview)
        tpl = _get_template('interview_confirmation')

        cls.send_email(
            recipient=interview.candidate.email,
            subject=tpl['subject'].format(**ctx),
            body=tpl['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interview_confirmation',
            sent_by=sent_by,
        )

        tpl_int = _get_template('interviewer_notification')
        cls.send_email(
            recipient=interview.interviewer_email,
            subject=tpl_int['subject'].format(**ctx),
            body=tpl_int['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interviewer_notification',
            sent_by=sent_by,
        )

    @classmethod
    def send_interview_cancellation(cls, interview, sent_by=None):
        ctx = cls._build_context(interview)
        tpl = _get_template('interview_cancellation')

        cls.send_email(
            recipient=interview.candidate.email,
            subject=tpl['subject'].format(**ctx),
            body=tpl['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interview_cancellation',
            sent_by=sent_by,
        )

        tpl_int = _get_template('interviewer_cancellation')
        cls.send_email(
            recipient=interview.interviewer_email,
            subject=tpl_int['subject'].format(**ctx),
            body=tpl_int['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interviewer_cancellation',
            sent_by=sent_by,
        )

    @classmethod
    def send_interview_reschedule(cls, interview, sent_by=None):
        ctx = cls._build_context(interview)
        tpl = _get_template('interview_reschedule')

        cls.send_email(
            recipient=interview.candidate.email,
            subject=tpl['subject'].format(**ctx),
            body=tpl['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interview_reschedule',
            sent_by=sent_by,
        )

        tpl_int = _get_template('interviewer_notification')
        cls.send_email(
            recipient=interview.interviewer_email,
            subject=tpl_int['subject'].format(**ctx),
            body=tpl_int['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interviewer_reschedule',
            sent_by=sent_by,
        )

    @classmethod
    def send_interview_reminder(cls, interview, sent_by=None):
        ctx = cls._build_context(interview)
        tpl = _get_template('interview_reminder')

        cls.send_email(
            recipient=interview.candidate.email,
            subject=tpl['subject'].format(**ctx),
            body=tpl['body'].format(**ctx),
            interview=interview,
            candidate=interview.candidate,
            email_type='interview_reminder',
            sent_by=sent_by,
        )
