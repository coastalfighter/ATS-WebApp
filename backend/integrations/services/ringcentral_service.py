import logging
import requests
from django.conf import settings as django_settings
from django.utils import timezone

logger = logging.getLogger('ats')


class RingCentralService:

    @staticmethod
    def _get_config():
        server_url = getattr(django_settings, 'RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com')
        client_id = getattr(django_settings, 'RINGCENTRAL_CLIENT_ID', '')
        client_secret = getattr(django_settings, 'RINGCENTRAL_CLIENT_SECRET', '')
        jwt_token = getattr(django_settings, 'RINGCENTRAL_JWT_TOKEN', '')
        return server_url, client_id, client_secret, jwt_token

    @classmethod
    def _refresh_user_token(cls, connection):
        server_url, client_id, client_secret, _ = cls._get_config()

        _, refresh_token = connection.get_tokens()
        if not refresh_token:
            return None

        refresh_data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
        }

        for attempt in range(2):
            try:
                if attempt == 0 and client_secret:
                    resp = requests.post(
                        f'{server_url}/restapi/oauth/token',
                        data=refresh_data,
                        auth=(client_id, client_secret),
                        headers={'Content-Type': 'application/x-www-form-urlencoded'},
                        timeout=15,
                    )
                else:
                    resp = requests.post(
                        f'{server_url}/restapi/oauth/token',
                        data={**refresh_data, 'client_id': client_id},
                        headers={'Content-Type': 'application/x-www-form-urlencoded'},
                        timeout=15,
                    )

                if resp.status_code < 400:
                    token_data = resp.json()
                    new_access = token_data.get('access_token', '')
                    new_refresh = token_data.get('refresh_token', refresh_token)
                    expires_in = token_data.get('expires_in', 3600)
                    connection.set_tokens(new_access, new_refresh)
                    connection.token_expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
                    connection.save(update_fields=['_encrypted_tokens', 'token_expires_at'])
                    logger.info(f'RC token refreshed for user {connection.user_id}')
                    return new_access

                if attempt == 0 and client_secret:
                    logger.info(f'RC refresh with secret failed ({resp.status_code}), trying without secret')
                    continue
                else:
                    logger.warning(f'RC token refresh failed for user {connection.user_id}: {resp.status_code} {resp.text[:200]}')
                    return None

            except Exception as e:
                logger.warning(f'RC token refresh exception for user {connection.user_id}: {e}')
                if attempt == 0 and client_secret:
                    continue
                return None

        return None

    @classmethod
    def _get_user_token(cls, user):
        from integrations.models import RingCentralConnection
        server_url = getattr(django_settings, 'RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com') or 'https://platform.ringcentral.com'

        try:
            conn = RingCentralConnection.objects.get(user=user, is_connected=True)
        except RingCentralConnection.DoesNotExist:
            return None, None, 'not_connected'

        access_token, _ = conn.get_tokens()
        if not access_token:
            return None, None, 'no_token'

        if conn.token_expires_at and conn.token_expires_at <= timezone.now():
            access_token = cls._refresh_user_token(conn)
            if not access_token:
                conn.is_connected = False
                conn.save(update_fields=['is_connected'])
                return None, None, 'token_expired'

        return access_token, server_url, 'ok'

    @classmethod
    def _get_access_token(cls, user=None):
        if user:
            token, server_url, status = cls._get_user_token(user)
            if token:
                return token, server_url
            if status == 'token_expired':
                return None, None

        server_url, client_id, client_secret, jwt_token = cls._get_config()
        if not all([client_id, client_secret, jwt_token]):
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
    def get_caller_phone(cls, user):
        token, server_url = cls._get_access_token(user=user)
        if not token:
            return None
        phone = None
        try:
            resp = requests.get(
                f'{server_url}/restapi/v1.0/account/~/extension/~/phone-number',
                headers={'Authorization': f'Bearer {token}'},
                timeout=10,
            )
            resp.raise_for_status()
            records = resp.json().get('records', [])
            for r in records:
                features = r.get('features', [])
                if 'CallerId' in features:
                    phone = r.get('phoneNumber')
                    break
            if not phone:
                for r in records:
                    if r.get('usageType') == 'DirectNumber':
                        phone = r.get('phoneNumber')
                        break
            if not phone and records:
                phone = records[0].get('phoneNumber')
        except Exception as e:
            logger.warning(f'Failed to fetch RC phone numbers: {e}')
        if phone and user:
            try:
                from integrations.models import RingCentralConnection
                RingCentralConnection.objects.filter(
                    user=user, is_connected=True, rc_phone_number='',
                ).update(rc_phone_number=phone)
            except Exception:
                pass
        return phone

    @classmethod
    def initiate_ringout(cls, from_number, to_number, user=None):
        if user:
            token, server_url, status = cls._get_user_token(user)
            if not token:
                if status == 'token_expired':
                    raise PermissionError('Your RingCentral session has expired. Please reconnect from your Profile page.')
                elif status == 'not_connected':
                    raise PermissionError('RingCentral not connected. Connect RingCentral in your Profile page.')
                else:
                    raise PermissionError('RingCentral connection error. Please reconnect from your Profile page.')
        else:
            token, server_url = cls._get_access_token()
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
