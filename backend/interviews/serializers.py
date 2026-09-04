from rest_framework import serializers
from .models import Interview, EmailLog
from candidates.serializers import CandidateListSerializer


class InterviewSerializer(serializers.ModelSerializer):
    candidate_detail = CandidateListSerializer(source='candidate', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = [
            'id', 'candidate', 'candidate_detail', 'interviewer_name',
            'interviewer_email', 'interview_type', 'scheduled_at',
            'duration_minutes', 'status', 'notes',
            'zoom_meeting_id', 'zoom_join_url', 'zoom_start_url',
            'google_event_id', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'zoom_meeting_id', 'zoom_join_url', 'zoom_start_url',
            'google_event_id', 'created_by', 'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None


class InterviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = [
            'candidate', 'interviewer_name', 'interviewer_email',
            'interview_type', 'scheduled_at', 'duration_minutes', 'notes',
        ]


class InterviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = [
            'interviewer_name', 'interviewer_email', 'interview_type',
            'scheduled_at', 'duration_minutes', 'notes',
        ]


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = [
            'id', 'interview', 'candidate', 'email_type', 'recipient',
            'subject', 'body', 'status', 'error_message', 'sent_at', 'sent_by',
        ]
