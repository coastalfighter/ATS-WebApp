import logging
import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('ats')


class ZoomService:
    TOKEN_URL = 'https://zoom.us/oauth/token'
    API_BASE = 'https://api.zoom.us/v2'

    @classmethod
    def _get_access_token_for_account(cls, zoom_account):
        creds = cls._resolve_credentials(zoom_account)
        if not creds:
            logger.warning(f'Zoom credentials incomplete for room: {zoom_account.room_name}')
            return None

        resp = requests.post(
            cls.TOKEN_URL,
            params={'grant_type': 'account_credentials', 'account_id': creds['account_id']},
            auth=(creds['client_id'], creds['client_secret']),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()['access_token']

    @classmethod
    def _resolve_credentials(cls, zoom_account):
        if zoom_account.account_id and zoom_account.client_id and zoom_account.client_secret:
            return {
                'account_id': zoom_account.account_id,
                'client_id': zoom_account.client_id,
                'client_secret': zoom_account.client_secret,
            }

        try:
            from integrations.models import IntegrationCredential
            cred = IntegrationCredential.objects.filter(
                provider='zoom',
                account_label=zoom_account.room_name,
                is_active=True,
            ).first()
            if cred:
                return cred.get_credentials()
        except Exception:
            pass

        return None

    @classmethod
    def _get_access_token(cls):
        account_id = settings.ZOOM_ACCOUNT_ID
        client_id = settings.ZOOM_CLIENT_ID
        client_secret = settings.ZOOM_CLIENT_SECRET

        if not all([account_id, client_id, client_secret]):
            logger.warning('Zoom credentials not configured')
            return None

        resp = requests.post(
            cls.TOKEN_URL,
            params={'grant_type': 'account_credentials', 'account_id': account_id},
            auth=(client_id, client_secret),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()['access_token']

    @classmethod
    def get_next_available_room(cls):
        from interviews.models import ZoomAccount
        rooms = list(ZoomAccount.objects.filter(is_active=True).order_by('last_used_at'))
        if not rooms:
            return None
        return rooms[0]

    @classmethod
    def create_meeting(cls, topic, start_time, duration_minutes=30, agenda='', zoom_account=None):
        if zoom_account:
            token = cls._get_access_token_for_account(zoom_account)
        else:
            token = cls._get_access_token()
        if not token:
            return None

        payload = {
            'topic': topic,
            'type': 2,
            'start_time': start_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'duration': duration_minutes,
            'agenda': agenda,
            'settings': {
                'join_before_host': True,
                'waiting_room': False,
                'auto_recording': 'none',
            },
        }

        resp = requests.post(
            f'{cls.API_BASE}/users/me/meetings',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if zoom_account:
            zoom_account.last_used_at = timezone.now()
            zoom_account.save(update_fields=['last_used_at'])

        return {
            'meeting_id': str(data['id']),
            'join_url': data['join_url'],
            'start_url': data['start_url'],
            'zoom_account': zoom_account,
        }

    @classmethod
    def update_meeting(cls, meeting_id, topic=None, start_time=None, duration_minutes=None, zoom_account=None):
        if zoom_account:
            token = cls._get_access_token_for_account(zoom_account)
        else:
            token = cls._get_access_token()
        if not token:
            return None

        payload = {}
        if topic:
            payload['topic'] = topic
        if start_time:
            payload['start_time'] = start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
        if duration_minutes:
            payload['duration'] = duration_minutes

        resp = requests.patch(
            f'{cls.API_BASE}/meetings/{meeting_id}',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        resp.raise_for_status()
        return True

    @classmethod
    def delete_meeting(cls, meeting_id, zoom_account=None):
        if zoom_account:
            token = cls._get_access_token_for_account(zoom_account)
        else:
            token = cls._get_access_token()
        if not token:
            return None

        resp = requests.delete(
            f'{cls.API_BASE}/meetings/{meeting_id}',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        resp.raise_for_status()
        return True
