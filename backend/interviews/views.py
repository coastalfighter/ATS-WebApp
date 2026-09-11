import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrSubadmin
from .models import Interview, EmailLog, ZoomAccount, Location, CallLog, InterviewSlot, InterviewFeedback, ObservationSheet
from .serializers import (
    InterviewSerializer, InterviewCreateSerializer,
    InterviewUpdateSerializer, EmailLogSerializer,
    ZoomAccountSerializer, ZoomAccountListSerializer,
    LocationSerializer, CallLogSerializer,
    InterviewSlotSerializer, InterviewSlotCreateSerializer,
    InterviewFeedbackSerializer, InterviewFeedbackCreateSerializer,
    ObservationSheetSerializer, ObservationSheetCreateSerializer,
)
from .services.zoom_service import ZoomService
from .tasks import (
    create_zoom_meeting_task, create_calendar_event_task,
    send_interview_confirmation_email, send_interview_cancellation_email,
    send_interview_reschedule_email, send_interview_reminder_email,
    update_zoom_meeting_task, update_calendar_event_task,
    delete_zoom_meeting_task, delete_calendar_event_task,
)

logger = logging.getLogger('ats')


class InterviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    ordering = ['-scheduled_at']

    def get_queryset(self):
        qs = Interview.objects.select_related('candidate', 'created_by', 'zoom_account').all()
        user = self.request.user
        if user.role == 'recruiter':
            qs = qs.filter(candidate__assigned_recruiter=user)
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        interview_type = self.request.query_params.get('interview_type')
        if interview_type:
            qs = qs.filter(interview_type=interview_type)
        scheduled_after = self.request.query_params.get('scheduled_after')
        if scheduled_after:
            qs = qs.filter(scheduled_at__date__gte=scheduled_after)
        scheduled_before = self.request.query_params.get('scheduled_before')
        if scheduled_before:
            qs = qs.filter(scheduled_at__date__lte=scheduled_before)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewCreateSerializer
        if self.action in ('update', 'partial_update'):
            return InterviewUpdateSerializer
        return InterviewSerializer

    def perform_create(self, serializer):
        interview = serializer.save(created_by=self.request.user)
        create_zoom_meeting_task.delay(interview.id)
        create_calendar_event_task.delay(interview.id)
        send_interview_confirmation_email.delay(interview.id)

    def perform_update(self, serializer):
        interview = serializer.save()
        update_zoom_meeting_task.delay(interview.id)
        update_calendar_event_task.delay(interview.id)
        send_interview_reschedule_email.delay(interview.id)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        interview = self.get_object()
        interview.status = 'cancelled'
        interview.save(update_fields=['status', 'updated_at'])

        if interview.zoom_meeting_id:
            delete_zoom_meeting_task.delay(
                interview.zoom_meeting_id,
                zoom_account_id=interview.zoom_account_id,
            )
        if interview.google_event_id:
            delete_calendar_event_task.delay(interview.google_event_id)

        send_interview_cancellation_email.delay(interview.id)
        return Response(InterviewSerializer(interview).data)

    @action(detail=True, methods=['post'])
    def send_reminder(self, request, pk=None):
        interview = self.get_object()
        if interview.status != 'scheduled':
            return Response(
                {'detail': 'Can only send reminders for scheduled interviews.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        send_interview_reminder_email.delay(interview.id)
        return Response({'detail': 'Reminder queued for sending.'})


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmailLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EmailLog.objects.all()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        interview_id = self.request.query_params.get('interview')
        if interview_id:
            qs = qs.filter(interview_id=interview_id)
        return qs


class ZoomAccountViewSet(viewsets.ModelViewSet):
    queryset = ZoomAccount.objects.all()
    permission_classes = [IsAdminOrSubadmin]

    def get_serializer_class(self):
        if self.action == 'list':
            return ZoomAccountListSerializer
        return ZoomAccountSerializer

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        room = self.get_object()
        room.is_active = not room.is_active
        room.save(update_fields=['is_active'])
        return Response(ZoomAccountSerializer(room).data)

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        room = self.get_object()
        try:
            token = ZoomService._get_access_token_for_account(room)
            if token:
                return Response({'status': 'connected', 'detail': 'Zoom account connected successfully.'})
            return Response(
                {'status': 'failed', 'detail': 'Could not obtain access token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {'status': 'failed', 'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Location.objects.all()
        if self.request.query_params.get('active_only') == 'true':
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrSubadmin])
    def toggle_active(self, request, pk=None):
        location = self.get_object()
        location.is_active = not location.is_active
        location.save(update_fields=['is_active'])
        return Response(LocationSerializer(location).data)


class CallLogViewSet(viewsets.ModelViewSet):
    serializer_class = CallLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = CallLog.objects.select_related('candidate', 'initiated_by').all()
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        provider = self.request.query_params.get('provider')
        if provider:
            qs = qs.filter(provider=provider)
        return qs

    def perform_create(self, serializer):
        serializer.save(initiated_by=self.request.user)


class InterviewSlotViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InterviewSlot.objects.select_related(
            'location', 'hiring_manager', 'zoom_account'
        ).all()
        location_id = self.request.query_params.get('location')
        if location_id:
            qs = qs.filter(location_id=location_id)
        hm_id = self.request.query_params.get('hiring_manager')
        if hm_id:
            qs = qs.filter(hiring_manager_id=hm_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(date__lte=date_to)
        active_only = self.request.query_params.get('active_only')
        if active_only == 'true':
            qs = qs.exclude(status='cancelled')
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewSlotCreateSerializer
        if self.action in ('update', 'partial_update'):
            return InterviewSlotCreateSerializer
        return InterviewSlotSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        slot = self.get_object()
        slot.status = InterviewSlot.SlotStatus.CANCELLED
        slot.save(update_fields=['status'])
        return Response(InterviewSlotSerializer(slot).data)

    @action(detail=True, methods=['post'])
    def update_capacity(self, request, pk=None):
        slot = self.get_object()
        max_cap = request.data.get('max_capacity')
        if max_cap is None:
            return Response(
                {'detail': 'max_capacity is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        max_cap = int(max_cap)
        if max_cap < slot.booked_count:
            return Response(
                {'detail': f'Cannot set capacity below current bookings ({slot.booked_count}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        slot.max_capacity = max_cap
        slot.save(update_fields=['max_capacity'])
        slot.refresh_status()
        return Response(InterviewSlotSerializer(slot).data)

    @action(detail=True, methods=['post'])
    def book(self, request, pk=None):
        slot = self.get_object()
        if slot.status == InterviewSlot.SlotStatus.CANCELLED:
            return Response(
                {'detail': 'Cannot book a cancelled slot.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if slot.booked_count >= slot.max_capacity:
            return Response(
                {'detail': 'Slot is fully booked.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        slot.booked_count += 1
        slot.save(update_fields=['booked_count'])
        slot.refresh_status()
        return Response(InterviewSlotSerializer(slot).data)

    @action(detail=True, methods=['post'])
    def unbook(self, request, pk=None):
        slot = self.get_object()
        if slot.booked_count <= 0:
            return Response(
                {'detail': 'No bookings to remove.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        slot.booked_count -= 1
        slot.save(update_fields=['booked_count'])
        slot.refresh_status()
        return Response(InterviewSlotSerializer(slot).data)


class InterviewFeedbackViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = InterviewFeedback.objects.select_related(
            'interview', 'interview__candidate', 'submitted_by'
        ).all()
        interview_id = self.request.query_params.get('interview')
        if interview_id:
            qs = qs.filter(interview_id=interview_id)
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(interview__candidate_id=candidate_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewFeedbackCreateSerializer
        return InterviewFeedbackSerializer

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)


class ObservationSheetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = ObservationSheet.objects.select_related(
            'interview', 'interview__candidate', 'trainer'
        ).all()
        interview_id = self.request.query_params.get('interview')
        if interview_id:
            qs = qs.filter(interview_id=interview_id)
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(interview__candidate_id=candidate_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return ObservationSheetCreateSerializer
        return ObservationSheetSerializer

    def perform_create(self, serializer):
        serializer.save(trainer=self.request.user)
