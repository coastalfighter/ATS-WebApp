from rest_framework import serializers
from .models import (
    Candidate, CandidateNote, CandidateActivityLog,
    UploadBatch, ImportRowError, RecruiterAssignmentHistory, AppSetting,
    FastGemUpload,
)
from accounts.serializers import UserSerializer


class CandidateListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='full_name', read_only=True)
    assigned_recruiter_name = serializers.SerializerMethodField()
    assigned_trainer_name = serializers.SerializerMethodField()
    call_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'email', 'phone',
            'alternate_phone', 'source', 'residential_location', 'job_market',
            'current_bucket', 'current_status',
            'assigned_recruiter', 'assigned_recruiter_name',
            'assigned_trainer', 'assigned_trainer_name',
            'date_of_birth', 'experience_years', 'current_company', 'current_designation',
            'follow_up_date', 'notes', 'created_at', 'updated_at',
            'call_count',
        ]

    def get_assigned_recruiter_name(self, obj):
        if obj.assigned_recruiter:
            return obj.assigned_recruiter.get_full_name()
        return None

    def get_assigned_trainer_name(self, obj):
        if obj.assigned_trainer:
            return obj.assigned_trainer.get_full_name()
        return None


class CandidateDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='full_name', read_only=True)
    assigned_recruiter_detail = UserSerializer(source='assigned_recruiter', read_only=True)
    assigned_trainer_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'email', 'phone',
            'alternate_phone', 'source', 'residential_location', 'job_market',
            'current_bucket', 'current_status',
            'assigned_recruiter', 'assigned_recruiter_detail',
            'assigned_trainer', 'assigned_trainer_name',
            'date_of_birth', 'experience_years', 'current_company', 'current_designation',
            'upload_batch', 'notes', 'follow_up_date',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
            'updated_by', 'updated_by_name',
        ]
        read_only_fields = [
            'id', 'current_bucket', 'created_at', 'updated_at',
            'created_by', 'updated_by',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def get_assigned_trainer_name(self, obj):
        return obj.assigned_trainer.get_full_name() if obj.assigned_trainer else None

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None


class CandidateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'alternate_phone', 'source', 'residential_location',
            'job_market', 'notes', 'assigned_recruiter',
            'date_of_birth', 'experience_years', 'current_company', 'current_designation',
        ]
        extra_kwargs = {
            'assigned_recruiter': {'required': False, 'allow_null': True},
        }


class CandidateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'alternate_phone', 'source', 'residential_location',
            'job_market', 'notes', 'follow_up_date',
            'date_of_birth', 'experience_years', 'current_company', 'current_designation',
        ]


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField()
    remarks = serializers.CharField(required=False, default='')
    is_admin_override = serializers.BooleanField(required=False, default=False)


class ReassignSerializer(serializers.Serializer):
    recruiter_id = serializers.IntegerField()
    remarks = serializers.CharField(required=False, default='')


class CandidateNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CandidateNote
        fields = ['id', 'candidate', 'note', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None


class CandidateActivityLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CandidateActivityLog
        fields = [
            'id', 'candidate', 'action_type', 'old_value', 'new_value',
            'remarks', 'performed_by', 'performed_by_name', 'created_at',
        ]

    def get_performed_by_name(self, obj):
        return obj.performed_by.get_full_name() if obj.performed_by else None


class ImportRowErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRowError
        fields = ['id', 'row_number', 'error_type', 'error_message', 'row_data']


class UploadBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    row_errors = ImportRowErrorSerializer(many=True, read_only=True)

    class Meta:
        model = UploadBatch
        fields = [
            'id', 'file_name', 'uploaded_by', 'uploaded_by_name',
            'total_rows', 'imported_count', 'duplicate_count',
            'invalid_count', 'skipped_count', 'status',
            'created_at', 'row_errors',
        ]

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else None


class UploadBatchListSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UploadBatch
        fields = [
            'id', 'file_name', 'uploaded_by', 'uploaded_by_name',
            'total_rows', 'imported_count', 'duplicate_count',
            'invalid_count', 'skipped_count', 'status', 'created_at',
        ]

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else None


class RecruiterAssignmentHistorySerializer(serializers.ModelSerializer):
    from_recruiter_name = serializers.SerializerMethodField()
    to_recruiter_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterAssignmentHistory
        fields = [
            'id', 'candidate', 'from_recruiter', 'from_recruiter_name',
            'to_recruiter', 'to_recruiter_name',
            'assigned_by', 'assigned_by_name', 'created_at',
        ]

    def get_from_recruiter_name(self, obj):
        return obj.from_recruiter.get_full_name() if obj.from_recruiter else None

    def get_to_recruiter_name(self, obj):
        return obj.to_recruiter.get_full_name() if obj.to_recruiter else None

    def get_assigned_by_name(self, obj):
        return obj.assigned_by.get_full_name() if obj.assigned_by else None


class AppSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppSetting
        fields = ['id', 'key', 'value', 'description', 'updated_at']


class FastGemUploadSerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FastGemUpload
        fields = [
            'id', 'candidate', 'candidate_name', 'uploaded_by', 'uploaded_by_name',
            'upload_data', 'status', 'external_reference_id', 'error_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'status', 'created_at', 'updated_at']

    def get_candidate_name(self, obj):
        return obj.candidate.full_name if obj.candidate else None

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else None


class FastGemUploadCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FastGemUpload
        fields = ['candidate', 'upload_data', 'external_reference_id']


class BulkStatusUpdateSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    status = serializers.CharField()
    remarks = serializers.CharField(required=False, default='')
    is_admin_override = serializers.BooleanField(required=False, default=False)


class BulkReassignSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    recruiter_id = serializers.IntegerField()
    remarks = serializers.CharField(required=False, default='')


class BulkDeleteSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
