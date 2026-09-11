import logging
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrSubadmin, IsAdminOrSubadminOrRecruiter
from .models import (
    Candidate, CandidateNote, CandidateActivityLog,
    UploadBatch, AppSetting,
)
from .serializers import (
    CandidateListSerializer, CandidateDetailSerializer,
    CandidateCreateSerializer, CandidateUpdateSerializer,
    StatusUpdateSerializer, ReassignSerializer,
    CandidateNoteSerializer, CandidateActivityLogSerializer,
    UploadBatchSerializer, UploadBatchListSerializer,
    RecruiterAssignmentHistorySerializer, AppSettingSerializer,
)
from .filters import CandidateFilter
from .constants import (
    BUCKET_FRESH, BUCKET_PIPELINE, FRESH_STATUS_CHOICES,
    PIPELINE_STATUS_CHOICES, VALID_PIPELINE_TRANSITIONS,
    ACTION_CANDIDATE_CREATED, ACTION_NOTES_UPDATED,
    ACTION_FOLLOW_UP_UPDATED, ACTION_CANDIDATE_EDITED,
    ACTION_TRAINER_ASSIGNED,
)
from .services.status_transition import StatusTransitionService, StatusTransitionError
from .services.assignment import AssignmentService
from .services.duplicate_detection import DuplicateDetectionService
from .services.import_handler import ImportHandler

logger = logging.getLogger('ats')


class CandidateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_class = CandidateFilter
    search_fields = ['first_name', 'last_name', 'email', 'phone', 'source']
    ordering_fields = ['created_at', 'updated_at', 'first_name', 'last_name', 'follow_up_date']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = Candidate.objects.select_related('assigned_recruiter', 'assigned_trainer', 'created_by', 'updated_by')
        user = self.request.user
        if user.role == 'recruiter':
            qs = qs.filter(assigned_recruiter=user)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return CandidateListSerializer
        if self.action == 'create':
            return CandidateCreateSerializer
        if self.action in ('update', 'partial_update'):
            return CandidateUpdateSerializer
        return CandidateDetailSerializer

    def perform_create(self, serializer):
        email = serializer.validated_data.get('email', '')
        phone = serializer.validated_data.get('phone', '')
        first_name = serializer.validated_data.get('first_name', '')
        last_name = serializer.validated_data.get('last_name', '')
        full_name = f"{first_name} {last_name}".strip()
        is_dup, dup_ids = DuplicateDetectionService.check_row(email, phone, full_name)
        if is_dup:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'detail': f'Duplicate candidate detected. Matches existing candidate(s): {dup_ids}'
            })

        explicit_recruiter = serializer.validated_data.pop('assigned_recruiter', None)
        candidate = serializer.save(
            created_by=self.request.user,
            current_bucket=BUCKET_FRESH,
        )
        if explicit_recruiter:
            AssignmentService.assign_candidate(candidate, explicit_recruiter, self.request.user)
        else:
            recruiter = AssignmentService.get_next_recruiter()
            if recruiter:
                AssignmentService.assign_candidate(candidate, recruiter, self.request.user)
        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=ACTION_CANDIDATE_CREATED,
            new_value=f"{candidate.full_name}",
            performed_by=self.request.user,
        )

    def perform_update(self, serializer):
        candidate = serializer.save(updated_by=self.request.user)
        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=ACTION_CANDIDATE_EDITED,
            performed_by=self.request.user,
            remarks='Candidate details updated',
        )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_admin_override = (
            serializer.validated_data.get('is_admin_override', False)
            and request.user.role in ('admin', 'subadmin')
        )
        try:
            candidate = StatusTransitionService.update_status(
                candidate=candidate,
                new_status=serializer.validated_data['status'],
                user=request.user,
                remarks=serializer.validated_data.get('remarks', ''),
                is_admin_override=is_admin_override,
            )
        except StatusTransitionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        candidate = self.get_object()
        serializer = ReassignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from accounts.models import User
        try:
            recruiter = User.objects.get(
                id=serializer.validated_data['recruiter_id'],
                role='recruiter',
                is_active=True,
            )
        except User.DoesNotExist:
            return Response(
                {'detail': 'Recruiter not found or inactive.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        remarks = serializer.validated_data.get('remarks', '')
        AssignmentService.reassign_candidate(candidate, recruiter, request.user, remarks=remarks)
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        candidate = self.get_object()
        note_text = request.data.get('note', '').strip()
        if not note_text:
            return Response(
                {'detail': 'Note text is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        note = CandidateNote.objects.create(
            candidate=candidate,
            note=note_text,
            created_by=request.user,
        )
        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=ACTION_NOTES_UPDATED,
            new_value=note_text[:100],
            performed_by=request.user,
        )
        return Response(CandidateNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def notes(self, request, pk=None):
        candidate = self.get_object()
        notes = candidate.candidate_notes.select_related('created_by').all()
        return Response(CandidateNoteSerializer(notes, many=True).data)

    @action(detail=True, methods=['get'])
    def activity(self, request, pk=None):
        candidate = self.get_object()
        logs = candidate.activity_logs.select_related('performed_by').all()
        return Response(CandidateActivityLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['get'])
    def assignment_history(self, request, pk=None):
        candidate = self.get_object()
        history = candidate.assignment_history.select_related(
            'from_recruiter', 'to_recruiter', 'assigned_by'
        ).all()
        return Response(RecruiterAssignmentHistorySerializer(history, many=True).data)

    @action(detail=True, methods=['post'])
    def set_follow_up(self, request, pk=None):
        candidate = self.get_object()
        follow_up_date = request.data.get('follow_up_date')
        candidate.follow_up_date = follow_up_date
        candidate.updated_by = request.user
        candidate.save(update_fields=['follow_up_date', 'updated_by', 'updated_at'])
        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=ACTION_FOLLOW_UP_UPDATED,
            new_value=str(follow_up_date) if follow_up_date else 'Cleared',
            performed_by=request.user,
        )
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=True, methods=['post'])
    def assign_trainer(self, request, pk=None):
        candidate = self.get_object()
        trainer_id = request.data.get('trainer_id')
        if not trainer_id:
            return Response(
                {'detail': 'trainer_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from accounts.models import User
        try:
            trainer = User.objects.get(id=trainer_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Trainer not found or inactive.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_trainer = candidate.assigned_trainer
        candidate.assigned_trainer = trainer
        candidate.updated_by = request.user
        candidate.save(update_fields=['assigned_trainer', 'updated_by', 'updated_at'])
        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=ACTION_TRAINER_ASSIGNED,
            old_value=old_trainer.get_full_name() if old_trainer else '',
            new_value=trainer.get_full_name(),
            performed_by=request.user,
        )
        return Response(CandidateDetailSerializer(candidate).data)

    @action(detail=False, methods=['get'])
    def fresh(self, request):
        from django.db.models import Count
        qs = Candidate.objects.select_related(
            'assigned_recruiter', 'created_by', 'updated_by'
        ).filter(current_bucket=BUCKET_FRESH).annotate(
            call_count=Count('call_logs')
        )
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CandidateListSerializer(page, many=True).data)
        return Response(CandidateListSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='fresh-summary')
    def fresh_summary(self, request):
        from django.db.models import Count, Q
        qs = Candidate.objects.filter(current_bucket=BUCKET_FRESH)
        # apply same filters except status
        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) |
                Q(email__icontains=search) | Q(phone__icontains=search) |
                Q(source__icontains=search)
            )
        recruiter = request.query_params.get('assigned_recruiter')
        if recruiter:
            qs = qs.filter(assigned_recruiter_id=recruiter)
        source = request.query_params.get('source')
        if source:
            qs = qs.filter(source__icontains=source)
        created_after = request.query_params.get('created_after')
        if created_after:
            qs = qs.filter(created_at__date__gte=created_after)
        created_before = request.query_params.get('created_before')
        if created_before:
            qs = qs.filter(created_at__date__lte=created_before)

        total = qs.count()
        status_counts = dict(qs.values_list('current_status').annotate(c=Count('id')))

        from .constants import (
            FRESH_NEVER_CONTACTED, FRESH_CONTACTED, FRESH_UNANSWERED,
            FRESH_NOT_INTERESTED, FRESH_ASKED_CONNECT_LATER,
            FRESH_WRONG_NUMBER, FRESH_INVALID_CONTACT, FRESH_DUPLICATE,
            FRESH_DO_NOT_CONTACT, FRESH_FOLLOW_UP_DUE, FRESH_INTERESTED,
        )

        return Response({
            'total': total,
            'never_contacted': status_counts.get(FRESH_NEVER_CONTACTED, 0),
            'contacted': status_counts.get(FRESH_CONTACTED, 0),
            'unanswered': status_counts.get(FRESH_UNANSWERED, 0),
            'not_interested': status_counts.get(FRESH_NOT_INTERESTED, 0),
            'callback': status_counts.get(FRESH_ASKED_CONNECT_LATER, 0) + status_counts.get(FRESH_FOLLOW_UP_DUE, 0),
            'closed': (
                status_counts.get(FRESH_WRONG_NUMBER, 0) +
                status_counts.get(FRESH_INVALID_CONTACT, 0) +
                status_counts.get(FRESH_DUPLICATE, 0) +
                status_counts.get(FRESH_DO_NOT_CONTACT, 0)
            ),
            'interested': status_counts.get(FRESH_INTERESTED, 0),
        })

    @action(detail=False, methods=['get'])
    def pipeline(self, request):
        from django.db.models import Count
        qs = Candidate.objects.select_related(
            'assigned_recruiter', 'created_by', 'updated_by'
        ).filter(current_bucket=BUCKET_PIPELINE).annotate(
            call_count=Count('call_logs')
        )
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CandidateListSerializer(page, many=True).data)
        return Response(CandidateListSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='pipeline-summary')
    def pipeline_summary(self, request):
        from django.db.models import Count, Q
        qs = Candidate.objects.filter(current_bucket=BUCKET_PIPELINE)
        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) |
                Q(email__icontains=search) | Q(phone__icontains=search) |
                Q(source__icontains=search)
            )
        recruiter = request.query_params.get('assigned_recruiter')
        if recruiter:
            qs = qs.filter(assigned_recruiter_id=recruiter)
        source = request.query_params.get('source')
        if source:
            qs = qs.filter(source__icontains=source)
        created_after = request.query_params.get('created_after')
        if created_after:
            qs = qs.filter(created_at__date__gte=created_after)
        created_before = request.query_params.get('created_before')
        if created_before:
            qs = qs.filter(created_at__date__lte=created_before)

        total = qs.count()
        status_counts = dict(qs.values_list('current_status').annotate(c=Count('id')))

        return Response({
            'total': total,
            'screening': status_counts.get('screening_scheduled', 0) + status_counts.get('screening_completed', 0),
            'interview_scheduled': status_counts.get('interview_scheduled', 0),
            'interview_completed': status_counts.get('interview_completed', 0),
            'round2': status_counts.get('round2_scheduled', 0) + status_counts.get('round2_completed', 0),
            'observation': status_counts.get('observation', 0),
            'training': status_counts.get('training', 0) + status_counts.get('training_completed', 0),
            'submitted': status_counts.get('submitted', 0),
            'selected': status_counts.get('selected', 0),
            'joined': status_counts.get('joined', 0),
            'hired': status_counts.get('hired', 0) + status_counts.get('fastgem_uploaded', 0),
            'rejected': status_counts.get('rejected', 0) + status_counts.get('dropped', 0),
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrSubadmin])
    def duplicates(self, request):
        from django.db.models import Count
        dup_emails = (
            Candidate.objects.values('email')
            .annotate(cnt=Count('id'))
            .filter(cnt__gt=1)
            .values_list('email', flat=True)
        )
        qs = Candidate.objects.filter(email__in=dup_emails).order_by('email', '-created_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CandidateListSerializer(page, many=True).data)
        return Response(CandidateListSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def status_options(self, request):
        bucket = request.query_params.get('bucket', BUCKET_FRESH)
        current_status = request.query_params.get('current_status')
        if bucket == BUCKET_FRESH:
            options = [{'value': s, 'label': l} for s, l in FRESH_STATUS_CHOICES]
        elif bucket == BUCKET_PIPELINE:
            if current_status and current_status in VALID_PIPELINE_TRANSITIONS:
                allowed = VALID_PIPELINE_TRANSITIONS[current_status]
                options = [
                    {'value': s, 'label': l}
                    for s, l in PIPELINE_STATUS_CHOICES if s in allowed
                ]
            else:
                options = [{'value': s, 'label': l} for s, l in PIPELINE_STATUS_CHOICES]
        else:
            options = []
        return Response(options)


class UploadView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'detail': 'No file provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        batch, error = ImportHandler.process_upload(file_obj, request.user)
        if error:
            return Response(
                {'detail': error, 'batch': UploadBatchSerializer(batch).data},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(UploadBatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class UploadPreviewView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'detail': 'No file provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        summary, rows, error = ImportHandler.preview_upload(file_obj)
        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        return Response(summary)


class UploadBatchViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = UploadBatch.objects.all()
        if self.request.user.role == 'recruiter':
            qs = qs.filter(uploaded_by=self.request.user)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return UploadBatchListSerializer
        return UploadBatchSerializer


class ActivityLogListView(generics.ListAPIView):
    serializer_class = CandidateActivityLogSerializer
    permission_classes = [IsAdminOrSubadmin]

    def get_queryset(self):
        qs = CandidateActivityLog.objects.select_related('candidate', 'performed_by').all()
        action_type = self.request.query_params.get('action_type')
        if action_type:
            qs = qs.filter(action_type=action_type)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(performed_by_id=user_id)
        created_after = self.request.query_params.get('created_after')
        if created_after:
            qs = qs.filter(created_at__date__gte=created_after)
        created_before = self.request.query_params.get('created_before')
        if created_before:
            qs = qs.filter(created_at__date__lte=created_before)
        return qs


class AppSettingViewSet(viewsets.ModelViewSet):
    queryset = AppSetting.objects.all()
    serializer_class = AppSettingSerializer
    permission_classes = [IsAdminOrSubadmin]
    lookup_field = 'key'
