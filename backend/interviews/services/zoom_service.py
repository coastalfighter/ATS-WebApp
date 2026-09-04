import logging
import requests
from django.conf import settings

logger = logging.getLogger('ats')


class ZoomService:
    TOKEN_URL = 'https://zoom.us/oauth/token'
    API_BASE = 'https://api.zoom.us/v2'

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
    def create_meeting(cls, topic, start_time, duration_minutes=30, agenda=''):
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
        return {
            'meeting_id': str(data['id']),
            'join_url': data['join_url'],
            'start_url': data['start_url'],
        }

    @classmethod
    def update_meeting(cls, meeting_id, topic=None, start_time=None, duration_minutes=None):
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
    def delete_meeting(cls, meeting_id):
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
