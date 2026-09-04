import csv
from django.http import HttpResponse
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrSubadmin
from candidates.models import Candidate, UploadBatch, CandidateActivityLog
from candidates.constants import (
    BUCKET_FRESH, BUCKET_PIPELINE,
    FRESH_CONTACTED, FRESH_NEVER_CONTACTED,
    FRESH_NOT_INTERESTED, FRESH_WRONG_NUMBER, FRESH_INVALID_CONTACT,
    FRESH_DO_NOT_CONTACT, FRESH_DUPLICATE,
    PIPELINE_INTERESTED,
    ACTION_STATUS_CHANGED,
)


class RecruiterWiseReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        data = (
            Candidate.objects.filter(assigned_recruiter__isnull=False)
            .values('assigned_recruiter__id', 'assigned_recruiter__first_name', 'assigned_recruiter__last_name')
            .annotate(
                total=Count('id'),
                fresh=Count('id', filter=Q(current_bucket=BUCKET_FRESH)),
                pipeline=Count('id', filter=Q(current_bucket=BUCKET_PIPELINE)),
                contacted=Count('id', filter=Q(current_status=FRESH_CONTACTED)),
                never_contacted=Count('id', filter=Q(current_status=FRESH_NEVER_CONTACTED)),
            )
            .order_by('assigned_recruiter__first_name')
        )
        return Response(list(data))


class ContactedVsUncontactedReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        total = Candidate.objects.count()
        contacted = Candidate.objects.exclude(current_status=FRESH_NEVER_CONTACTED).count()
        uncontacted = Candidate.objects.filter(current_status=FRESH_NEVER_CONTACTED).count()
        return Response({
            'total': total,
            'contacted': contacted,
            'uncontacted': uncontacted,
        })


class FreshToPipelineReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        fresh_total = Candidate.objects.filter(current_bucket=BUCKET_FRESH).count()
        pipeline_total = Candidate.objects.filter(current_bucket=BUCKET_PIPELINE).count()
        conversions = CandidateActivityLog.objects.filter(
            action_type=ACTION_STATUS_CHANGED,
            new_value=PIPELINE_INTERESTED,
        ).count()
        return Response({
            'fresh_total': fresh_total,
            'pipeline_total': pipeline_total,
            'conversions': conversions,
            'conversion_rate': round((conversions / max(fresh_total + pipeline_total, 1)) * 100, 2),
        })


class NegativeBreakdownReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        negative_statuses = [
            FRESH_NOT_INTERESTED, FRESH_WRONG_NUMBER,
            FRESH_INVALID_CONTACT, FRESH_DO_NOT_CONTACT, FRESH_DUPLICATE,
        ]
        data = (
            Candidate.objects.filter(current_status__in=negative_statuses)
            .values('current_status')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        return Response(list(data))


class FollowUpPendingReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        qs = Candidate.objects.filter(
            follow_up_date__isnull=False,
            follow_up_date__lte=today,
        )
        if request.user.role == 'recruiter':
            qs = qs.filter(assigned_recruiter=request.user)
        from candidates.serializers import CandidateListSerializer
        data = CandidateListSerializer(qs, many=True).data
        return Response(data)


class PipelineStagesReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        data = (
            Candidate.objects.filter(current_bucket=BUCKET_PIPELINE)
            .values('current_status')
            .annotate(count=Count('id'))
            .order_by('current_status')
        )
        return Response(list(data))


class UploadBatchSummaryReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        from candidates.serializers import UploadBatchListSerializer
        batches = UploadBatch.objects.all()[:50]
        return Response(UploadBatchListSerializer(batches, many=True).data)


class DuplicateReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        dup_emails = (
            Candidate.objects.values('email')
            .annotate(cnt=Count('id'))
            .filter(cnt__gt=1)
        )
        total_duplicates = sum(item['cnt'] - 1 for item in dup_emails)
        return Response({
            'duplicate_email_groups': dup_emails.count(),
            'total_duplicate_records': total_duplicates,
            'details': list(dup_emails.order_by('-cnt')[:20]),
        })


class DailyTrendsReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        from django.db.models.functions import TruncDate
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timezone.timedelta(days=days)

        daily = (
            Candidate.objects.filter(created_at__gte=start_date)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        return Response(list(daily))


class RecruiterProductivityReportView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        from django.db.models.functions import TruncDate
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timezone.timedelta(days=days)

        data = (
            CandidateActivityLog.objects.filter(created_at__gte=start_date)
            .values('performed_by__id', 'performed_by__first_name', 'performed_by__last_name')
            .annotate(
                total_actions=Count('id'),
                status_changes=Count('id', filter=Q(action_type=ACTION_STATUS_CHANGED)),
            )
            .order_by('-total_actions')
        )
        return Response(list(data))


class ExportCandidatesCSVView(APIView):
    permission_classes = [IsAdminOrSubadmin]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="candidates_export.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'First Name', 'Last Name', 'Email', 'Phone',
            'Alternate Phone', 'Source', 'Bucket', 'Status',
            'Assigned Recruiter', 'Follow-up Date', 'Created At',
        ])

        qs = Candidate.objects.select_related('assigned_recruiter').all()

        bucket = request.query_params.get('bucket')
        if bucket:
            qs = qs.filter(current_bucket=bucket)
        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(current_status=status_param)
        recruiter = request.query_params.get('recruiter')
        if recruiter:
            qs = qs.filter(assigned_recruiter_id=recruiter)

        for c in qs.iterator():
            writer.writerow([
                c.id, c.first_name, c.last_name, c.email, c.phone,
                c.alternate_phone, c.source, c.current_bucket, c.current_status,
                c.assigned_recruiter.get_full_name() if c.assigned_recruiter else '',
                c.follow_up_date or '', c.created_at.strftime('%Y-%m-%d %H:%M'),
            ])

        return response
