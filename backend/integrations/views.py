import logging
import secrets
import requests
from urllib.parse import urlencode
from django.conf import settings as django_settings
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from accounts.permissions import IsAdminOrSubadmin
from .models import IntegrationCredential, EmailTemplate
from .serializers import (
    IntegrationCredentialSerializer,
    IntegrationCredentialCreateSerializer,
    EmailTemplateSerializer,
)

logger = logging.getLogger('ats')


class IntegrationCredentialViewSet(viewsets.ModelViewSet):
    queryset = IntegrationCredential.objects.all()
    permission_classes = [IsAdminOrSubadmin]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return IntegrationCredentialCreateSerializer
        return IntegrationCredentialSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='verify')
    def verify_credentials(self, request, pk=None):
        credential = self.get_object()
        creds = credential.get_credentials()

        credential.last_verified_at = timezone.now()
        credential.save(update_fields=['last_verified_at'])
        return Response({'status': 'ok', 'message': 'Credentials saved. Verification pending.'})


class RingCentralCallView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'detail': 'candidate_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        from candidates.models import Candidate
        try:
            candidate = Candidate.objects.get(id=candidate_id)
        except Candidate.DoesNotExist:
            return Response({'detail': 'Candidate not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not candidate.phone:
            return Response({'detail': 'Candidate has no phone number.'}, status=status.HTTP_400_BAD_REQUEST)

        from .services.ringcentral_service import RingCentralService

        from_number = request.data.get('from_number', request.user.phone or '')
        if not from_number:
            from .models import RingCentralConnection
            try:
                rc_conn = RingCentralConnection.objects.get(user=request.user, is_connected=True)
                from_number = rc_conn.rc_phone_number
            except RingCentralConnection.DoesNotExist:
                pass
        if not from_number:
            from_number = RingCentralService.get_caller_phone(user=request.user)
        if not from_number:
            return Response({'detail': 'No caller phone number. Set your phone in profile or connect RingCentral.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = RingCentralService.initiate_ringout(from_number, candidate.phone, user=request.user)
            if result is None:
                return Response({'detail': 'RingCentral not configured. Connect RingCentral in your profile.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            from interviews.models import CallLog
            CallLog.objects.create(
                candidate=candidate,
                phone_number=candidate.phone,
                direction='outbound',
                status='completed',
                provider='ringcentral',
                provider_call_id=result.get('session_id', ''),
                initiated_by=request.user,
                notes=f'RingOut to {candidate.phone}',
            )

            return Response(result)
        except Exception as e:
            logger.exception(f'RingCentral call failed: {e}')
            return Response({'detail': f'Call failed: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)


class RingCentralStatusView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'detail': 'session_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        from .services.ringcentral_service import RingCentralService
        try:
            result = RingCentralService.get_call_status(session_id, user=request.user)
            if result is None:
                return Response({'detail': 'RingCentral not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class SyncCallLogsView(generics.GenericAPIView):
    permission_classes = [IsAdminOrSubadmin]

    def post(self, request):
        from .tasks import sync_ringcentral_call_logs
        try:
            sync_ringcentral_call_logs.delay()
        except Exception:
            return Response({'detail': 'Task queue unavailable. Please try again later.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'detail': 'Call log sync initiated.'})


class RingCentralAuthorizeView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        redirect_uri = request.query_params.get('redirect_uri')
        if not redirect_uri:
            return Response({'detail': 'redirect_uri required.'}, status=status.HTTP_400_BAD_REQUEST)

        server_url = getattr(django_settings, 'RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com')
        client_id = getattr(django_settings, 'RINGCENTRAL_CLIENT_ID', '')
        if not client_id:
            return Response(
                {'detail': 'RingCentral not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        state = secrets.token_urlsafe(32)

        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'state': state,
        }
        authorize_url = f'{server_url}/restapi/oauth/authorize?{urlencode(params)}'

        return Response({
            'authorize_url': authorize_url,
            'state': state,
        })


class RingCentralCallbackView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get('code')
        redirect_uri = request.data.get('redirect_uri')
        if not code or not redirect_uri:
            return Response({'detail': 'code and redirect_uri required.'}, status=status.HTTP_400_BAD_REQUEST)

        server_url = getattr(django_settings, 'RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com')
        client_id = getattr(django_settings, 'RINGCENTRAL_CLIENT_ID', '')
        client_secret = getattr(django_settings, 'RINGCENTRAL_CLIENT_SECRET', '')

        if not all([client_id, client_secret]):
            return Response({'detail': 'RingCentral not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            resp = requests.post(
                f'{server_url}/restapi/oauth/token',
                data={
                    'grant_type': 'authorization_code',
                    'code': code,
                    'redirect_uri': redirect_uri,
                },
                auth=(client_id, client_secret),
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=15,
            )
            resp.raise_for_status()
            token_data = resp.json()
        except requests.RequestException as e:
            logger.exception(f'RC OAuth token exchange failed: {e}')
            return Response({'detail': 'Failed to exchange authorization code.'}, status=status.HTTP_502_BAD_GATEWAY)

        access_token = token_data.get('access_token', '')
        refresh_token = token_data.get('refresh_token', '')
        expires_in = token_data.get('expires_in', 3600)

        rc_email = ''
        rc_phone = ''
        rc_user_id = ''
        headers = {'Authorization': f'Bearer {access_token}'}
        try:
            info_resp = requests.get(
                f'{server_url}/restapi/v1.0/account/~/extension/~',
                headers=headers,
                timeout=10,
            )
            info_resp.raise_for_status()
            info = info_resp.json()
            rc_user_id = str(info.get('id', ''))
            contact = info.get('contact', {})
            rc_email = contact.get('email', '')
        except Exception as e:
            logger.warning(f'Failed to fetch RC user info: {e}')

        try:
            pn_resp = requests.get(
                f'{server_url}/restapi/v1.0/account/~/extension/~/phone-number',
                headers=headers,
                timeout=10,
            )
            pn_resp.raise_for_status()
            records = pn_resp.json().get('records', [])
            for r in records:
                features = r.get('features', [])
                if 'CallerId' in features:
                    rc_phone = r.get('phoneNumber', '')
                    break
            if not rc_phone:
                for r in records:
                    if r.get('usageType') == 'DirectNumber':
                        rc_phone = r.get('phoneNumber', '')
                        break
            if not rc_phone and records:
                rc_phone = records[0].get('phoneNumber', '')
        except Exception as e:
            logger.warning(f'Failed to fetch RC phone numbers: {e}')

        from .models import RingCentralConnection
        conn, _ = RingCentralConnection.objects.update_or_create(
            user=request.user,
            defaults={
                'is_connected': True,
                'rc_user_id': rc_user_id,
                'rc_email': rc_email,
                'rc_phone_number': rc_phone,
                'token_expires_at': timezone.now() + timezone.timedelta(seconds=expires_in),
            },
        )
        conn.set_tokens(access_token, refresh_token)
        conn.save(update_fields=['_encrypted_tokens'])

        return Response({
            'status': 'connected',
            'rc_email': rc_email,
            'rc_phone_number': rc_phone,
        })


class RingCentralConnectionView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import RingCentralConnection
        try:
            conn = RingCentralConnection.objects.get(user=request.user)
            return Response({
                'is_connected': conn.is_connected,
                'rc_email': conn.rc_email,
                'rc_phone_number': conn.rc_phone_number,
                'updated_at': conn.updated_at.isoformat(),
            })
        except RingCentralConnection.DoesNotExist:
            return Response({
                'is_connected': False,
                'rc_email': '',
                'rc_phone_number': '',
            })

    def delete(self, request):
        from .models import RingCentralConnection
        try:
            conn = RingCentralConnection.objects.get(user=request.user)

            access_token, _ = conn.get_tokens()
            if access_token:
                server_url = getattr(django_settings, 'RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com')
                client_id = getattr(django_settings, 'RINGCENTRAL_CLIENT_ID', '')
                client_secret = getattr(django_settings, 'RINGCENTRAL_CLIENT_SECRET', '')
                try:
                    requests.post(
                        f'{server_url}/restapi/oauth/revoke',
                        data={'token': access_token},
                        auth=(client_id, client_secret),
                        timeout=10,
                    )
                except Exception:
                    pass

            conn.is_connected = False
            conn._encrypted_tokens = ''
            conn.rc_email = ''
            conn.rc_phone_number = ''
            conn.rc_user_id = ''
            conn.save()
        except RingCentralConnection.DoesNotExist:
            pass
        return Response({'status': 'disconnected'})


class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAdminOrSubadmin]
    http_method_names = ['get', 'patch', 'head', 'options']
    lookup_field = 'template_key'

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def preview(self, request, template_key=None):
        template = self.get_object()
        sample_context = {
            'candidate_name': 'John Doe',
            'interviewer_name': 'Jane Smith',
            'date': '2025-01-15',
            'time': '10:00 AM',
            'duration': '30 minutes',
            'location': 'Conference Room A',
            'zoom_link': 'https://zoom.us/j/123456789',
            'company_name': 'ATS Corp',
        }
        from django.template import Template, Context
        try:
            rendered_subject = Template(template.subject_template).render(Context(sample_context))
            rendered_body = Template(template.body_template).render(Context(sample_context))
            return Response({'subject': rendered_subject, 'body': rendered_body})
        except Exception as e:
            return Response({'detail': f'Template error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
