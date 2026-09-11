import logging
from .models import Notification, NotificationPreference

logger = logging.getLogger('ats')


class NotificationService:

    @staticmethod
    def create(recipient, title, message, category='info', link=''):
        pref, _ = NotificationPreference.objects.get_or_create(user=recipient)
        if not pref.in_app_enabled:
            return None

        notification = Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            category=category,
            link=link,
        )
        logger.info(f'Notification created: "{title}" → {recipient}')
        return notification

    @staticmethod
    def should_email(recipient, event_type):
        pref, _ = NotificationPreference.objects.get_or_create(user=recipient)
        mapping = {
            'booking': pref.email_on_booking,
            'assignment': pref.email_on_assignment,
            'interview': pref.email_on_interview,
            'status_change': pref.email_on_status_change,
        }
        return mapping.get(event_type, False)

    @staticmethod
    def notify_and_email(recipient, title, message, event_type, category='info', link=''):
        notification = NotificationService.create(
            recipient, title, message, category, link
        )
        if notification and NotificationService.should_email(recipient, event_type):
            from .tasks import send_notification_email
            send_notification_email.delay(notification.id)
        return notification
