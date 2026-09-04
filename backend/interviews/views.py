import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from candidates.models import CandidateActivityLog
from candidates.constants import (
    ACTION_ZOOM_MEETING_CREATED, ACTION_CALENDAR_EVENT_CREATED, ACTION_EMAIL_SENT,
)
from .models import Interview, EmailLog
from .serializers import (
    InterviewSerializer, InterviewCreateSerializer,
    InterviewUpdateSerializer, EmailLogSerializer,
)
from .services.zoom_service import ZoomService
from .services.calendar_service import GoogleCalendarService
from .services.email_service import EmailService

logger = logging.getLogger('ats')


class InterviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    ordering = ['-scheduled_at']

    def get_queryset(self):
        qs = Interview.objects.select_related('candidate', 'created_by').all()
        user = self.request.user
        if user.role == 'recruiter':
            qs = qs.filter(candidate__assigned_recruiter=user)
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewCreateSerializer
        if self.action in ('update', 'partial_update'):
            return InterviewUpdateSerializer
        return InterviewSerializer

    def perform_create(self, serializer):
        interview = serializer.save(created_by=self.request.user)

        try:
            zoom_data = ZoomService.create_meeting(
                topic=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
                start_time=interview.scheduled_at,
                duration_minutes=interview.duration_minutes,
                agenda=interview.notes,
            )
            if zoom_data:
                interview.zoom_meeting_id = zoom_data['meeting_id']
                interview.zoom_join_url = zoom_data['join_url']
                interview.zoom_start_url = zoom_data['start_url']
                interview.save()
                CandidateActivityLog.objects.create(
                    candidate=interview.candidate,
                    action_type=ACTION_ZOOM_MEETING_CREATED,
                    new_value=zoom_data['join_url'],
                    performed_by=self.request.user,
                )
        except Exception as e:
            logger.exception(f'Zoom meeting creation failed: {e}')

        try:
            attendees = [interview.candidate.email, interview.interviewer_email]
            event_id = GoogleCalendarService.create_event(
                summary=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
                description=interview.notes,
                start_time=interview.scheduled_at,
                duration_minutes=interview.duration_minutes,
                attendees=attendees,
            )
            if event_id:
                interview.google_event_id = event_id
                interview.save()
                CandidateActivityLog.objects.create(
                    candidate=interview.candidate,
                    action_type=ACTION_CALENDAR_EVENT_CREATED,
                    new_value=event_id,
                    performed_by=self.request.user,
                )
        except Exception as e:
            logger.exception(f'Google Calendar event creation failed: {e}')

        try:
            EmailService.send_interview_confirmation(interview, sent_by=self.request.user)
            CandidateActivityLog.objects.create(
                candidate=interview.candidate,
                action_type=ACTION_EMAIL_SENT,
                new_value='Interview confirmation emails sent',
                performed_by=self.request.user,
            )
        except Exception as e:
            logger.exception(f'Email sending failed: {e}')

    def perform_update(self, serializer):
        interview = serializer.save()

        if interview.zoom_meeting_id:
            try:
                ZoomService.update_meeting(
                    meeting_id=interview.zoom_meeting_id,
                    topic=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
                    start_time=interview.scheduled_at,
                    duration_minutes=interview.duration_minutes,
                )
            except Exception as e:
                logger.exception(f'Zoom meeting update failed: {e}')

        if interview.google_event_id:
            try:
                GoogleCalendarService.update_event(
                    event_id=interview.google_event_id,
                    summary=f"{interview.get_interview_type_display()} - {interview.candidate.full_name}",
                    start_time=interview.scheduled_at,
                    duration_minutes=interview.duration_minutes,
                )
            except Exception as e:
                logger.exception(f'Calendar event update failed: {e}')

        try:
            EmailService.send_interview_reschedule(interview, sent_by=self.request.user)
        except Exception as e:
            logger.exception(f'Reschedule email failed: {e}')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        interview = self.get_object()
        interview.status = 'cancelled'
        interview.save(update_fields=['status', 'updated_at'])

        if interview.zoom_meeting_id:
            try:
                ZoomService.delete_meeting(interview.zoom_meeting_id)
            except Exception as e:
                logger.exception(f'Zoom meeting deletion failed: {e}')

        if interview.google_event_id:
            try:
                GoogleCalendarService.delete_event(interview.google_event_id)
            except Exception as e:
                logger.exception(f'Calendar event deletion failed: {e}')

        try:
            EmailService.send_interview_cancellation(interview, sent_by=request.user)
        except Exception as e:
            logger.exception(f'Cancellation email failed: {e}')

        return Response(InterviewSerializer(interview).data)

    @action(detail=True, methods=['post'])
    def send_reminder(self, request, pk=None):
        interview = self.get_object()
        if interview.status != 'scheduled':
            return Response(
                {'detail': 'Can only send reminders for scheduled interviews.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            EmailService.send_interview_reminder(interview, sent_by=request.user)
            return Response({'detail': 'Reminder sent successfully.'})
        except Exception as e:
            return Response(
                {'detail': f'Failed to send reminder: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmailLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EmailLog.objects.all()
        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        interview_id = self.request.query_params.get('interview')
        if interview_id:
            qs = qs.filter(interview_id=interview_id)
        return qs
