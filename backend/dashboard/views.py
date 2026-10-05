from datetime import timedelta, date as date_cls
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework import viewsets, status

from accounts.permissions import IsAdminOrSubadmin
from candidates.models import Candidate, CandidateActivityLog, UploadBatch
from candidates.constants import (
    BUCKET_FRESH, BUCKET_PIPELINE,
    FRESH_NEVER_CONTACTED, FRESH_FOLLOW_UP_DUE,
    PIPELINE_SELECTED, PIPELINE_JOINED,
)
from interviews.models import Interview, CallLog, ZoomAccount
from bookings.models import Booking
from .models import WeeklyBookingGoal
from .serializers import WeeklyBookingGoalSerializer, BulkSetGoalsSerializer


class RecruiterDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'recruiter':
            candidates = Candidate.objects.filter(assigned_recruiter=user, is_migrated=False)
        else:
            candidates = Candidate.objects.filter(is_migrated=False)

        today = timezone.now().date()

        fresh_count = candidates.filter(current_bucket=BUCKET_FRESH).count()
        pipeline_count = candidates.filter(current_bucket=BUCKET_PIPELINE).count()
        never_contacted = candidates.filter(current_status=FRESH_NEVER_CONTACTED).count()
        follow_ups_due = candidates.filter(
            follow_up_date__lte=today, follow_up_date__isnull=False,
            current_status=FRESH_FOLLOW_UP_DUE,
        ).count()

        if user.role == 'recruiter':
            upcoming_interviews = Interview.objects.filter(
                candidate__assigned_recruiter=user,
                status='scheduled',
                scheduled_at__gte=timezone.now(),
            ).count()
        else:
            upcoming_interviews = Interview.objects.filter(
                status='scheduled',
                scheduled_at__gte=timezone.now(),
            ).count()

        recent_activity = CandidateActivityLog.objects.select_related(
            'candidate', 'performed_by'
        )
        if user.role == 'recruiter':
            recent_activity = recent_activity.filter(performed_by=user)
        recent_activity = recent_activity.order_by('-created_at')[:10]

        from candidates.serializers import CandidateActivityLogSerializer
        return Response({
            'fresh_count': fresh_count,
            'pipeline_count': pipeline_count,
            'never_contacted': never_contacted,
            'follow_ups_due': follow_ups_due,
            'upcoming_interviews': upcoming_interviews,
            'total_candidates': candidates.count(),
            'recent_activity': CandidateActivityLogSerializer(recent_activity, many=True).data,
        })


class AdminDashboardView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        today = timezone.now().date()
        if date_from:
            try:
                parts = date_from.split('-')
                start_date = date_cls(int(parts[0]), int(parts[1]), int(parts[2]))
            except (ValueError, IndexError):
                start_date = today - timedelta(days=6)
        else:
            start_date = today - timedelta(days=6)

        if date_to:
            try:
                parts = date_to.split('-')
                end_date = date_cls(int(parts[0]), int(parts[1]), int(parts[2]))
            except (ValueError, IndexError):
                end_date = today
        else:
            end_date = today

        fresh_qs = Candidate.objects.filter(is_migrated=False)
        total = fresh_qs.count()
        fresh = fresh_qs.filter(current_bucket=BUCKET_FRESH).count()
        pipeline = fresh_qs.filter(current_bucket=BUCKET_PIPELINE).count()

        bookings_in_range = Interview.objects.filter(
            scheduled_at__date__gte=start_date,
            scheduled_at__date__lte=end_date,
            status='scheduled',
        ).count()

        leads_in_range = fresh_qs.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).count()

        calls_in_range = CallLog.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).count()

        missing_zoom = Interview.objects.filter(
            status='scheduled',
            scheduled_at__gte=timezone.now(),
            zoom_join_url='',
        ).count()

        next_interview = Interview.objects.filter(
            status='scheduled',
            scheduled_at__gte=timezone.now(),
        ).select_related(
            'candidate', 'candidate__assigned_recruiter', 'created_by', 'zoom_account',
        ).order_by('scheduled_at').first()

        next_slot_data = None
        if next_interview:
            slot_start = next_interview.scheduled_at
            slot_end = slot_start + timedelta(minutes=next_interview.duration_minutes)
            slot_interviews = Interview.objects.filter(
                status='scheduled',
                scheduled_at__gte=slot_start,
                scheduled_at__lt=slot_start + timedelta(hours=1),
            ).select_related('candidate', 'candidate__assigned_recruiter', 'zoom_account')

            applicants = []
            recruiters_set = set()
            for iv in slot_interviews:
                applicants.append({
                    'id': iv.candidate.id,
                    'name': iv.candidate.full_name,
                })
                if iv.candidate.assigned_recruiter:
                    rec = iv.candidate.assigned_recruiter
                    recruiters_set.add((rec.id, rec.get_full_name()))

            next_slot_data = {
                'scheduled_at': next_interview.scheduled_at.isoformat(),
                'end_at': slot_end.isoformat(),
                'duration_minutes': next_interview.duration_minutes,
                'interviewer_name': next_interview.interviewer_name,
                'interviewer_email': next_interview.interviewer_email,
                'interview_type': next_interview.interview_type,
                'location': next_interview.location or '',
                'zoom_room': next_interview.zoom_account.room_name if next_interview.zoom_account else '',
                'zoom_join_url': next_interview.zoom_join_url,
                'applicant_count': slot_interviews.count(),
                'applicants': applicants,
                'recruiters': [{'id': r[0], 'name': r[1]} for r in recruiters_set],
                'created_by_name': next_interview.created_by.get_full_name() if next_interview.created_by else '',
            }

        daily_leads = list(
            fresh_qs.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
            )
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        daily_calls = list(
            CallLog.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
            )
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        date_labels = []
        leads_map = {str(d['date']): d['count'] for d in daily_leads}
        calls_map = {str(d['date']): d['count'] for d in daily_calls}
        leads_series = []
        calls_series = []

        current = start_date
        while current <= end_date:
            ds = str(current)
            date_labels.append(ds)
            leads_series.append(leads_map.get(ds, 0))
            calls_series.append(calls_map.get(ds, 0))
            current += timedelta(days=1)

        status_breakdown = list(
            fresh_qs.values('current_status')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        recruiter_stats = list(
            fresh_qs.filter(assigned_recruiter__isnull=False)
            .values('assigned_recruiter__first_name', 'assigned_recruiter__last_name', 'assigned_recruiter__id')
            .annotate(
                total=Count('id'),
                fresh=Count('id', filter=Q(current_bucket=BUCKET_FRESH)),
                pipeline=Count('id', filter=Q(current_bucket=BUCKET_PIPELINE)),
                selected=Count('id', filter=Q(current_status=PIPELINE_SELECTED)),
                joined=Count('id', filter=Q(current_status=PIPELINE_JOINED)),
            )
        )

        from candidates.serializers import CandidateActivityLogSerializer
        recent_activity = CandidateActivityLog.objects.select_related(
            'candidate', 'performed_by'
        ).order_by('-created_at')[:10]

        return Response({
            'date_from': str(start_date),
            'date_to': str(end_date),
            'total_candidates': total,
            'fresh_count': fresh,
            'pipeline_count': pipeline,
            'bookings_in_range': bookings_in_range,
            'leads_in_range': leads_in_range,
            'calls_in_range': calls_in_range,
            'missing_zoom': missing_zoom,
            'next_slot': next_slot_data,
            'daily_leads': {'labels': date_labels, 'data': leads_series},
            'daily_calls': {'labels': date_labels, 'data': calls_series},
            'status_breakdown': status_breakdown,
            'recruiter_stats': recruiter_stats,
            'recent_activity': CandidateActivityLogSerializer(recent_activity, many=True).data,
        })


class WeeklyBookingGoalView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def _parse_date(self, s):
        parts = s.split('-')
        return date_cls(int(parts[0]), int(parts[1]), int(parts[2]))

    def _get_week_range(self, week_start):
        return week_start, week_start + timedelta(days=6)

    def get(self, request):
        week_start_param = request.query_params.get('week_start')
        today = timezone.now().date()

        if week_start_param:
            try:
                week_start = self._parse_date(week_start_param)
            except (ValueError, IndexError):
                week_start = today - timedelta(days=today.weekday())
        else:
            week_start = today - timedelta(days=today.weekday())

        week_start_dt, week_end = self._get_week_range(week_start)

        goals = WeeklyBookingGoal.objects.filter(
            week_start=week_start_dt
        ).select_related('location', 'recruiter').order_by('location__name', 'recruiter__first_name')

        rows = []
        total_goal = 0
        total_booked = 0
        total_showed = 0
        total_remaining = 0

        for g in goals:
            booking_filter = Q(
                interview_slot__location=g.location,
                interview_slot__date__gte=week_start_dt,
                interview_slot__date__lte=week_end,
            )
            if g.recruiter:
                booking_filter &= Q(booked_by=g.recruiter)

            booked = Booking.objects.filter(booking_filter).exclude(
                status='cancelled'
            ).count()

            showed = Booking.objects.filter(
                booking_filter, status='confirmed'
            ).count()

            remaining = max(0, g.goal - booked)
            show_up_pct = round((showed / booked) * 100, 2) if booked > 0 else 0

            total_goal += g.goal
            total_booked += booked
            total_showed += showed
            total_remaining += remaining

            rows.append({
                'id': g.id,
                'location_id': g.location_id,
                'location_name': g.location.name,
                'recruiter_id': g.recruiter_id,
                'recruiter_name': (g.recruiter.first_name or g.recruiter.get_full_name()) if g.recruiter else '',
                'goal': g.goal,
                'booked': booked,
                'showed': showed,
                'remaining': remaining,
                'show_up_pct': show_up_pct,
            })

        total_show_up_pct = round((total_showed / total_booked) * 100, 2) if total_booked > 0 else 0

        return Response({
            'week_start': str(week_start_dt),
            'week_end': str(week_end),
            'goals': rows,
            'totals': {
                'goal': total_goal,
                'booked': total_booked,
                'showed': total_showed,
                'remaining': total_remaining,
                'show_up_pct': total_show_up_pct,
            },
        })

    def post(self, request):
        serializer = BulkSetGoalsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        week_start = serializer.validated_data['week_start']
        goals_data = serializer.validated_data['goals']
        created_count = 0

        for item in goals_data:
            recruiter_val = item.get('recruiter')
            recruiter_id = recruiter_val if recruiter_val else None
            WeeklyBookingGoal.objects.update_or_create(
                location_id=item['location'],
                recruiter_id=recruiter_id,
                week_start=week_start,
                defaults={
                    'goal': item['goal'],
                    'created_by': request.user,
                },
            )
            created_count += 1

        return Response(
            {'detail': f'{created_count} goals saved for week of {week_start}.'},
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        goal_id = request.query_params.get('id')
        if not goal_id:
            return Response({'detail': 'id parameter required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            goal = WeeklyBookingGoal.objects.get(id=goal_id)
            goal.delete()
            return Response({'detail': 'Goal deleted.'})
        except WeeklyBookingGoal.DoesNotExist:
            return Response({'detail': 'Goal not found.'}, status=status.HTTP_404_NOT_FOUND)
