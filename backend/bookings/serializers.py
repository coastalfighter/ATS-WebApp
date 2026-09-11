from rest_framework import serializers
from .models import Booking, BookingActivityLog


class BookingListSerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()
    candidate_email = serializers.SerializerMethodField()
    candidate_phone = serializers.SerializerMethodField()
    slot_date = serializers.DateField(source='interview_slot.date', read_only=True)
    slot_start_time = serializers.TimeField(source='interview_slot.start_time', read_only=True)
    slot_end_time = serializers.TimeField(source='interview_slot.end_time', read_only=True)
    location_name = serializers.SerializerMethodField()
    hiring_manager_name = serializers.SerializerMethodField()
    booked_by_name = serializers.SerializerMethodField()
    interview_id = serializers.IntegerField(source='interview.id', read_only=True, default=None)

    class Meta:
        model = Booking
        fields = [
            'id', 'candidate', 'candidate_name', 'candidate_email', 'candidate_phone',
            'interview_slot', 'slot_date', 'slot_start_time', 'slot_end_time',
            'location_name', 'hiring_manager_name',
            'booked_by', 'booked_by_name', 'status', 'round',
            'interview', 'interview_id', 'cancellation_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_candidate_name(self, obj):
        return obj.candidate.full_name if obj.candidate else None

    def get_candidate_email(self, obj):
        return obj.candidate.email if obj.candidate else None

    def get_candidate_phone(self, obj):
        return obj.candidate.phone if obj.candidate else None

    def get_location_name(self, obj):
        return str(obj.interview_slot.location) if obj.interview_slot and obj.interview_slot.location else None

    def get_hiring_manager_name(self, obj):
        hm = obj.interview_slot.hiring_manager if obj.interview_slot else None
        return hm.get_full_name() if hm else None

    def get_booked_by_name(self, obj):
        return obj.booked_by.get_full_name() if obj.booked_by else None


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['candidate', 'interview_slot', 'round']

    def validate(self, data):
        candidate = data['candidate']
        slot = data['interview_slot']
        round_val = data.get('round', Booking.Round.ROUND_1)

        if slot.status == 'cancelled':
            raise serializers.ValidationError({'interview_slot': 'Cannot book a cancelled slot.'})

        if slot.booked_count >= slot.max_capacity:
            raise serializers.ValidationError({'interview_slot': 'This slot is fully booked.'})

        active_booking = Booking.objects.filter(
            candidate=candidate,
            round=round_val,
            status__in=['pending', 'confirmed'],
        ).exists()
        if active_booking:
            raise serializers.ValidationError({
                'candidate': f'Candidate already has an active booking for {round_val}.'
            })

        return data

    def create(self, validated_data):
        booking = super().create(validated_data)
        slot = booking.interview_slot
        slot.booked_count += 1
        slot.save(update_fields=['booked_count'])
        slot.refresh_status()
        return booking


class BookingDetailSerializer(BookingListSerializer):
    activity_logs = serializers.SerializerMethodField()

    class Meta(BookingListSerializer.Meta):
        fields = BookingListSerializer.Meta.fields + ['activity_logs']

    def get_activity_logs(self, obj):
        logs = obj.activity_logs.all()[:20]
        return BookingActivityLogSerializer(logs, many=True).data


class BookingActivityLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BookingActivityLog
        fields = ['id', 'action', 'old_value', 'new_value', 'performed_by', 'performed_by_name', 'created_at']

    def get_performed_by_name(self, obj):
        return obj.performed_by.get_full_name() if obj.performed_by else None
