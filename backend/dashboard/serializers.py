from rest_framework import serializers
from .models import WeeklyBookingGoal


class WeeklyBookingGoalSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    recruiter_name = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyBookingGoal
        fields = [
            'id', 'location', 'location_name',
            'recruiter', 'recruiter_name',
            'week_start', 'goal',
            'created_at', 'updated_at',
        ]

    def get_recruiter_name(self, obj):
        if obj.recruiter:
            return obj.recruiter.first_name or obj.recruiter.get_full_name()
        return ''


class BulkGoalItemSerializer(serializers.Serializer):
    location = serializers.CharField()
    recruiter = serializers.CharField(required=False, allow_null=True)
    goal = serializers.IntegerField(min_value=0)


class BulkSetGoalsSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    goals = BulkGoalItemSerializer(many=True)
