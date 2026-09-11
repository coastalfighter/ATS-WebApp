import logging
from datetime import datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Booking, BookingActivityLog
from .serializers import BookingListSerializer, BookingCreateSerializer, BookingDetailSerializer
from interviews.tasks import (
    create_zoom_meeting_task, create_calendar_event_task,
    send_interview_confirmation_email,
)

logger = logging.getLogger('ats')


class BookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = Booking.objects.select_related(
            'candidate', 'interview_slot', 'interview_slot__location',
            'interview_slot__hiring_manager', 'booked_by', 'interview',
        ).all()

        candidate_id = self.request.query_params.get('candidate')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)

        slot_id = self.request.query_params.get('slot') or self.request.query_params.get('interview_slot')
        if slot_id:
            qs = qs.filter(interview_slot_id=slot_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        round_param = self.request.query_params.get('round')
        if round_param:
            qs = qs.filter(round=round_param)

        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(candidate__first_name__icontains=search) |
                Q(candidate__last_name__icontains=search) |
                Q(candidate__email__icontains=search) |
                Q(candidate__phone__icontains=search)
            )

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        if self.action == 'retrieve':
            return BookingDetailSerializer
        return BookingListSerializer

    def perform_create(self, serializer):
        booking = serializer.save(booked_by=self.request.user)
        BookingActivityLog.objects.create(
            booking=booking,
            action='booking_created',
            new_value=f'{booking.candidate.full_name} → {booking.interview_slot}',
            performed_by=self.request.user,
        )

        from notifications.services import NotificationService
        hm = booking.interview_slot.hiring_manager
        if hm and hm != self.request.user:
            NotificationService.notify_and_email(
                recipient=hm,
                title='New booking in your slot',
                message=f'{booking.candidate.full_name} has been booked into your interview slot on {booking.interview_slot.date}.',
                event_type='booking',
                category='info',
                link=f'/candidates/{booking.candidate.id}',
            )

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        booking = self.get_object()

        if booking.status != Booking.BookingStatus.PENDING:
            return Response(
                {'detail': f'Cannot confirm a booking with status "{booking.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        slot = booking.interview_slot
        scheduled_at = datetime.combine(slot.date, slot.start_time)

        from interviews.models import Interview
        duration = (
            datetime.combine(slot.date, slot.end_time) - datetime.combine(slot.date, slot.start_time)
        ).seconds // 60

        interview = Interview.objects.create(
            candidate=booking.candidate,
            interviewer_name=slot.hiring_manager.get_full_name(),
            interviewer_email=slot.hiring_manager.email,
            interview_type='screening' if booking.round == 'round_1' else 'technical',
            scheduled_at=scheduled_at,
            duration_minutes=duration or 30,
            location=str(slot.location) if slot.location else '',
            notes=f'Auto-created from booking #{booking.id}',
            zoom_account=slot.zoom_account,
            created_by=request.user,
        )

        booking.interview = interview
        booking.status = Booking.BookingStatus.CONFIRMED
        booking.save(update_fields=['interview', 'status', 'updated_at'])

        BookingActivityLog.objects.create(
            booking=booking,
            action='booking_confirmed',
            old_value='pending',
            new_value='confirmed',
            performed_by=request.user,
        )

        from notifications.services import NotificationService
        recruiter = booking.candidate.assigned_recruiter
        if recruiter and recruiter != request.user:
            NotificationService.notify_and_email(
                recipient=recruiter,
                title='Booking confirmed',
                message=f'Booking for {booking.candidate.full_name} has been confirmed for {booking.interview_slot.date}.',
                event_type='booking',
                category='info',
                link=f'/candidates/{booking.candidate.id}',
            )

        create_zoom_meeting_task.delay(interview.id)
        create_calendar_event_task.delay(interview.id)
        send_interview_confirmation_email.delay(interview.id)

        from candidates.constants import (
            PIPELINE_INTERESTED, PIPELINE_SCREENING_SCHEDULED,
            PIPELINE_INTERVIEW_SCHEDULED,
        )
        candidate = booking.candidate
        if booking.round == 'round_1' and candidate.current_status == PIPELINE_INTERESTED:
            candidate.current_status = PIPELINE_SCREENING_SCHEDULED
            candidate.save(update_fields=['current_status', 'updated_at'])
        elif booking.round == 'round_1' and candidate.current_status == 'screening_completed':
            candidate.current_status = PIPELINE_INTERVIEW_SCHEDULED
            candidate.save(update_fields=['current_status', 'updated_at'])

        return Response(BookingListSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()

        if booking.status in (Booking.BookingStatus.CANCELLED, Booking.BookingStatus.NO_SHOW):
            return Response(
                {'detail': f'Booking is already {booking.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '')
        old_status = booking.status
        booking.status = Booking.BookingStatus.CANCELLED
        booking.cancellation_reason = reason
        booking.save(update_fields=['status', 'cancellation_reason', 'updated_at'])

        slot = booking.interview_slot
        if slot.booked_count > 0:
            slot.booked_count -= 1
            slot.save(update_fields=['booked_count'])
            slot.refresh_status()

        BookingActivityLog.objects.create(
            booking=booking,
            action='booking_cancelled',
            old_value=old_status,
            new_value='cancelled',
            performed_by=request.user,
        )

        return Response(BookingListSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def mark_no_show(self, request, pk=None):
        booking = self.get_object()

        if booking.status != Booking.BookingStatus.CONFIRMED:
            return Response(
                {'detail': 'Can only mark confirmed bookings as no-show.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = Booking.BookingStatus.NO_SHOW
        booking.save(update_fields=['status', 'updated_at'])

        BookingActivityLog.objects.create(
            booking=booking,
            action='booking_no_show',
            old_value='confirmed',
            new_value='no_show',
            performed_by=request.user,
        )

        return Response(BookingListSerializer(booking).data)
