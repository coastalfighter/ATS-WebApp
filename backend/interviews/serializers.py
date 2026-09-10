from rest_framework import serializers
from .models import Interview, EmailLog, ZoomAccount, Location, CallLog, InterviewSlot
from candidates.serializers import CandidateListSerializer


class ZoomAccountSerializer(serializers.ModelSerializer):
    active_meetings = serializers.SerializerMethodField()

    class Meta:
        model = ZoomAccount
        fields = [
            'id', 'room_name', 'account_id', 'client_id', 'client_secret',
            'is_active', 'last_used_at', 'active_meetings', 'created_at',
        ]
        extra_kwargs = {
            'client_secret': {'write_only': True},
        }

    def get_active_meetings(self, obj):
        return obj.interviews.filter(status='scheduled').count()


class ZoomAccountListSerializer(serializers.ModelSerializer):
    active_meetings = serializers.SerializerMethodField()

    class Meta:
        model = ZoomAccount
        fields = ['id', 'room_name', 'is_active', 'last_used_at', 'active_meetings']

    def get_active_meetings(self, obj):
        return obj.interviews.filter(status='scheduled').count()


class InterviewSerializer(serializers.ModelSerializer):
    candidate_detail = CandidateListSerializer(source='candidate', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    zoom_room_name = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = [
            'id', 'candidate', 'candidate_detail', 'interviewer_name',
            'interviewer_email', 'interview_type', 'scheduled_at',
            'duration_minutes', 'location', 'status', 'notes',
            'zoom_account', 'zoom_room_name',
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

    def get_zoom_room_name(self, obj):
        return obj.zoom_account.room_name if obj.zoom_account else None


class InterviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = [
            'candidate', 'interviewer_name', 'interviewer_email',
            'interview_type', 'scheduled_at', 'duration_minutes',
            'location', 'notes',
        ]


class InterviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = [
            'interviewer_name', 'interviewer_email', 'interview_type',
            'scheduled_at', 'duration_minutes', 'location', 'notes',
        ]


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = [
            'id', 'interview', 'candidate', 'email_type', 'recipient',
            'subject', 'body', 'status', 'error_message', 'sent_at', 'sent_by',
        ]


class LocationSerializer(serializers.ModelSerializer):
    interview_count = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = [
            'id', 'name', 'address', 'city', 'state', 'country',
            'latitude', 'longitude', 'is_active', 'interview_count', 'created_at',
        ]

    def get_interview_count(self, obj):
        return Interview.objects.filter(location=obj.name).count()


class InterviewSlotSerializer(serializers.ModelSerializer):
    location_name = serializers.SerializerMethodField()
    hiring_manager_name = serializers.SerializerMethodField()
    zoom_room_name = serializers.SerializerMethodField()

    class Meta:
        model = InterviewSlot
        fields = [
            'id', 'location', 'location_name', 'hiring_manager',
            'hiring_manager_name', 'date', 'start_time', 'end_time',
            'max_capacity', 'booked_count', 'meeting_link',
            'zoom_account', 'zoom_room_name', 'status', 'created_by',
            'created_at',
        ]
        read_only_fields = ['id', 'booked_count', 'status', 'created_by', 'created_at']

    def get_location_name(self, obj):
        return str(obj.location) if obj.location else None

    def get_hiring_manager_name(self, obj):
        return obj.hiring_manager.get_full_name() if obj.hiring_manager else None

    def get_zoom_room_name(self, obj):
        if obj.zoom_account:
            return obj.zoom_account.room_name
        return None


class InterviewSlotCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewSlot
        fields = [
            'location', 'hiring_manager', 'date', 'start_time',
            'end_time', 'max_capacity', 'meeting_link', 'zoom_account',
        ]

    def validate(self, data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})
        return data


class CallLogSerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()
    initiated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CallLog
        fields = [
            'id', 'candidate', 'candidate_name', 'phone_number', 'direction',
            'duration_seconds', 'status', 'provider', 'provider_call_id',
            'notes', 'initiated_by', 'initiated_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_candidate_name(self, obj):
        return obj.candidate.full_name if obj.candidate else None

    def get_initiated_by_name(self, obj):
        return obj.initiated_by.get_full_name() if obj.initiated_by else None
