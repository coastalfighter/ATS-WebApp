import logging
import requests
from django.conf import settings as django_settings
from django.utils import timezone
from candidates.models import AppSetting

logger = logging.getLogger('ats')


class RingCentralService:

    @staticmethod
    def _get_config():
        server_url = AppSetting.get('ringcentral_server_url', 'https://platform.ringcentral.com')
        client_id = AppSetting.get('ringcentral_client_id', '')
        client_secret = AppSetting.get('ringcentral_client_secret', '')
        jwt_token = AppSetting.get('ringcentral_jwt_token', '')
        return server_url, client_id, client_secret, jwt_token

    @classmethod
    def _refresh_user_token(cls, connection):
        server_url, client_id, client_secret, _ = cls._get_config()
        if not client_id:
            client_id = getattr(django_settings, 'RINGCENTRAL_CLIENT_ID', '')
        if not client_secret:
            client_secret = getattr(django_settings, 'RINGCENTRAL_CLIENT_SECRET', '')

        _, refresh_token = connection.get_tokens()
        if not refresh_token:
            connection.is_connected = False
            connection.save(update_fields=['is_connected'])
            return None

        try:
            resp = requests.post(
                f'{server_url}/restapi/oauth/token',
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token,
                },
                auth=(client_id, client_secret),
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=15,
            )
            resp.raise_for_status()
            token_data = resp.json()
            new_access = token_data.get('access_token', '')
            new_refresh = token_data.get('refresh_token', refresh_token)
            expires_in = token_data.get('expires_in', 3600)
            connection.set_tokens(new_access, new_refresh)
            connection.token_expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
            connection.save(update_fields=['_encrypted_tokens', 'token_expires_at'])
            return new_access
        except Exception as e:
            logger.warning(f'RC token refresh failed for user {connection.user_id}: {e}')
            connection.is_connected = False
            connection.save(update_fields=['is_connected'])
            return None

    @classmethod
    def _get_access_token(cls, user=None):
        server_url, client_id, client_secret, jwt_token = cls._get_config()

        if user:
            from integrations.models import RingCentralConnection
            try:
                conn = RingCentralConnection.objects.get(user=user, is_connected=True)
                access_token, _ = conn.get_tokens()
                if access_token:
                    if conn.token_expires_at and conn.token_expires_at <= timezone.now():
                        access_token = cls._refresh_user_token(conn)
                        if not access_token:
                            return None, None
                    if not server_url:
                        server_url = 'https://platform.ringcentral.com'
                    return access_token, server_url
            except RingCentralConnection.DoesNotExist:
                pass

        if not all([client_id, client_secret, jwt_token]):
            rc_client_id = getattr(django_settings, 'RINGCENTRAL_CLIENT_ID', '')
            rc_client_secret = getattr(django_settings, 'RINGCENTRAL_CLIENT_SECRET', '')
            rc_jwt_token = getattr(django_settings, 'RINGCENTRAL_JWT_TOKEN', '')
            rc_server_url = getattr(django_settings, 'RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com')
            if all([rc_client_id, rc_client_secret, rc_jwt_token]):
                client_id, client_secret, jwt_token, server_url = rc_client_id, rc_client_secret, rc_jwt_token, rc_server_url
            else:
                logger.warning('RingCentral credentials not configured')
                return None, None

        resp = requests.post(
            f'{server_url}/restapi/oauth/token',
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': jwt_token,
            },
            auth=(client_id, client_secret),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()['access_token'], server_url

    @classmethod
    def initiate_ringout(cls, from_number, to_number, user=None):
        token, server_url = cls._get_access_token(user=user)
        if not token:
            return None

        resp = requests.post(
            f'{server_url}/restapi/v1.0/account/~/extension/~/ring-out',
            json={
                'from': {'phoneNumber': from_number},
                'to': {'phoneNumber': to_number},
                'callerId': {'phoneNumber': from_number},
                'playPrompt': False,
            },
            headers={'Authorization': f'Bearer {token}'},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            'session_id': data.get('id'),
            'status': data.get('status', {}).get('callStatus', 'unknown'),
        }

    @classmethod
    def get_call_status(cls, session_id, user=None):
        token, server_url = cls._get_access_token(user=user)
        if not token:
            return None

        resp = requests.get(
            f'{server_url}/restapi/v1.0/account/~/extension/~/ring-out/{session_id}',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            'session_id': data.get('id'),
            'status': data.get('status', {}).get('callStatus', 'unknown'),
            'caller_status': data.get('status', {}).get('callerStatus', 'unknown'),
            'callee_status': data.get('status', {}).get('calleeStatus', 'unknown'),
        }

    @classmethod
    def fetch_call_logs(cls, date_from=None, date_to=None):
        token, server_url = cls._get_access_token()
        if not token:
            return []

        params = {
            'type': 'Voice',
            'view': 'Detailed',
            'perPage': 100,
        }
        if date_from:
            params['dateFrom'] = date_from.isoformat()
        if date_to:
            params['dateTo'] = date_to.isoformat()

        resp = requests.get(
            f'{server_url}/restapi/v1.0/account/~/extension/~/call-log',
            params=params,
            headers={'Authorization': f'Bearer {token}'},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get('records', [])
