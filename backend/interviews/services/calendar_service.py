import logging
from datetime import timedelta
from django.conf import settings

logger = logging.getLogger('ats')


class GoogleCalendarService:

    @classmethod
    def _get_service(cls, calendar_id=None):
        service_account_file = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_FILE', '')

        if service_account_file:
            return cls._get_service_account(service_account_file)

        credentials_file = settings.GOOGLE_CALENDAR_CREDENTIALS_FILE
        token_file = settings.GOOGLE_CALENDAR_TOKEN_FILE

        if not credentials_file or not token_file:
            logger.warning('Google Calendar credentials not configured')
            return None

        try:
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build
            import os

            SCOPES = ['https://www.googleapis.com/auth/calendar']
            creds = None

            if os.path.exists(token_file):
                creds = Credentials.from_authorized_user_file(token_file, SCOPES)

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(credentials_file, SCOPES)
                    creds = flow.run_local_server(port=0)
                with open(token_file, 'w') as token:
                    token.write(creds.to_json())

            return build('calendar', 'v3', credentials=creds)
        except Exception as e:
            logger.exception(f'Failed to initialize Google Calendar service: {e}')
            return None

    @classmethod
    def _get_service_account(cls, service_account_file):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            SCOPES = ['https://www.googleapis.com/auth/calendar']
            credentials = service_account.Credentials.from_service_account_file(
                service_account_file, scopes=SCOPES
            )

            owner_email = getattr(settings, 'GOOGLE_CALENDAR_OWNER', '')
            if owner_email:
                credentials = credentials.with_subject(owner_email)

            return build('calendar', 'v3', credentials=credentials)
        except Exception as e:
            logger.exception(f'Failed to initialize Google Calendar service account: {e}')
            return None

    @classmethod
    def create_event(cls, summary, description, start_time, duration_minutes=30, attendees=None, calendar_id=None):
        service = cls._get_service()
        if not service:
            return None

        end_time = start_time + timedelta(minutes=duration_minutes)
        event = {
            'summary': summary,
            'description': description,
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': 'UTC',
            },
        }
        if attendees:
            event['attendees'] = [{'email': e} for e in attendees]

        cal_id = calendar_id or settings.GOOGLE_CALENDAR_ID
        result = service.events().insert(calendarId=cal_id, body=event).execute()
        return result.get('id')

    @classmethod
    def update_event(cls, event_id, summary=None, description=None, start_time=None, duration_minutes=None, calendar_id=None):
        service = cls._get_service()
        if not service:
            return None

        cal_id = calendar_id or settings.GOOGLE_CALENDAR_ID
        event = service.events().get(calendarId=cal_id, eventId=event_id).execute()

        if summary:
            event['summary'] = summary
        if description:
            event['description'] = description
        if start_time:
            event['start'] = {'dateTime': start_time.isoformat(), 'timeZone': 'UTC'}
            end_time = start_time + timedelta(minutes=duration_minutes or 30)
            event['end'] = {'dateTime': end_time.isoformat(), 'timeZone': 'UTC'}

        service.events().update(calendarId=cal_id, eventId=event_id, body=event).execute()
        return True

    @classmethod
    def delete_event(cls, event_id, calendar_id=None):
        service = cls._get_service()
        if not service:
            return None

        cal_id = calendar_id or settings.GOOGLE_CALENDAR_ID
        service.events().delete(calendarId=cal_id, eventId=event_id).execute()
        return True
