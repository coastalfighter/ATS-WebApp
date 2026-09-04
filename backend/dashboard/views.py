from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrSubadmin
from candidates.models import Candidate, CandidateActivityLog
from candidates.constants import (
    BUCKET_FRESH, BUCKET_PIPELINE,
    FRESH_NEVER_CONTACTED, FRESH_CONTACTED, FRESH_FOLLOW_UP_DUE,
    PIPELINE_INTERVIEW_SCHEDULED, PIPELINE_SELECTED, PIPELINE_JOINED,
)
from interviews.models import Interview


class RecruiterDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'recruiter':
            candidates = Candidate.objects.filter(assigned_recruiter=user)
        else:
            candidates = Candidate.objects.all()

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
        total = Candidate.objects.count()
        fresh = Candidate.objects.filter(current_bucket=BUCKET_FRESH).count()
        pipeline = Candidate.objects.filter(current_bucket=BUCKET_PIPELINE).count()

        status_breakdown = (
            Candidate.objects.values('current_status')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        recruiter_stats = (
            Candidate.objects.filter(assigned_recruiter__isnull=False)
            .values('assigned_recruiter__first_name', 'assigned_recruiter__last_name', 'assigned_recruiter__id')
            .annotate(
                total=Count('id'),
                fresh=Count('id', filter=Q(current_bucket=BUCKET_FRESH)),
                pipeline=Count('id', filter=Q(current_bucket=BUCKET_PIPELINE)),
                selected=Count('id', filter=Q(current_status=PIPELINE_SELECTED)),
                joined=Count('id', filter=Q(current_status=PIPELINE_JOINED)),
            )
        )

        upcoming_interviews = Interview.objects.filter(
            status='scheduled', scheduled_at__gte=timezone.now()
        ).count()

        from interviews.serializers import InterviewSerializer
        upcoming_list = Interview.objects.filter(
            status='scheduled', scheduled_at__gte=timezone.now()
        ).select_related('candidate', 'created_by').order_by('scheduled_at')[:5]

        return Response({
            'total_candidates': total,
            'fresh_count': fresh,
            'pipeline_count': pipeline,
            'status_breakdown': list(status_breakdown),
            'recruiter_stats': list(recruiter_stats),
            'upcoming_interviews_count': upcoming_interviews,
            'upcoming_interviews': InterviewSerializer(upcoming_list, many=True).data,
        })
