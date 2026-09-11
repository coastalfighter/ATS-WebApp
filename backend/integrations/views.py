import logging
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

        if credential.provider == 'zoom':
            try:
                from interviews.services.zoom_service import ZoomService
                import requests as req
                resp = req.post(
                    ZoomService.TOKEN_URL,
                    params={'grant_type': 'account_credentials', 'account_id': creds.get('account_id', '')},
                    auth=(creds.get('client_id', ''), creds.get('client_secret', '')),
                    timeout=10,
                )
                resp.raise_for_status()
                credential.last_verified_at = timezone.now()
                credential.save(update_fields=['last_verified_at'])
                return Response({'status': 'ok', 'message': 'Zoom credentials verified.'})
            except Exception as e:
                return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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

        from_number = request.data.get('from_number', request.user.phone or '')
        if not from_number:
            return Response({'detail': 'No caller phone number. Set your phone in profile.'}, status=status.HTTP_400_BAD_REQUEST)

        from .services.ringcentral_service import RingCentralService
        try:
            result = RingCentralService.initiate_ringout(from_number, candidate.phone)
            if result is None:
                return Response({'detail': 'RingCentral not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

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
            result = RingCentralService.get_call_status(session_id)
            if result is None:
                return Response({'detail': 'RingCentral not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return Response(result)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class SyncCallLogsView(generics.GenericAPIView):
    permission_classes = [IsAdminOrSubadmin]

    def post(self, request):
        from .tasks import sync_ringcentral_call_logs
        sync_ringcentral_call_logs.delay()
        return Response({'detail': 'Call log sync initiated.'})


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
