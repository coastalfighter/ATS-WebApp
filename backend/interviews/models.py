from django.db import models
from django.conf import settings


class ZoomAccount(models.Model):
    room_name = models.CharField(max_length=100)
    account_id = models.CharField(max_length=200)
    client_id = models.CharField(max_length=200)
    client_secret = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['room_name']

    def __str__(self):
        return f"{self.room_name} ({'Active' if self.is_active else 'Inactive'})"


class Interview(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
        RESCHEDULED = 'rescheduled', 'Rescheduled'

    class InterviewType(models.TextChoices):
        SCREENING = 'screening', 'Screening'
        TECHNICAL = 'technical', 'Technical'
        HR = 'hr', 'HR'
        FINAL = 'final', 'Final'

    candidate = models.ForeignKey(
        'candidates.Candidate', on_delete=models.CASCADE, related_name='interviews'
    )
    interviewer_name = models.CharField(max_length=200)
    interviewer_email = models.EmailField()
    interview_type = models.CharField(
        max_length=20, choices=InterviewType.choices, default=InterviewType.SCREENING
    )
    scheduled_at = models.DateTimeField()
    duration_minutes = models.IntegerField(default=30)
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    notes = models.TextField(blank=True)
    zoom_account = models.ForeignKey(
        ZoomAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='interviews'
    )
    zoom_meeting_id = models.CharField(max_length=100, blank=True)
    zoom_join_url = models.URLField(max_length=2048, blank=True)
    zoom_start_url = models.URLField(max_length=2048, blank=True)
    google_event_id = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_interviews'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"{self.interview_type} - {self.candidate} at {self.scheduled_at}"


class EmailLog(models.Model):
    interview = models.ForeignKey(
        Interview, on_delete=models.CASCADE, related_name='email_logs', null=True, blank=True
    )
    candidate = models.ForeignKey(
        'candidates.Candidate', on_delete=models.CASCADE, related_name='email_logs'
    )
    email_type = models.CharField(max_length=50)
    recipient = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[('sent', 'Sent'), ('failed', 'Failed')],
        default='sent',
    )
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.email_type} to {self.recipient} ({self.status})"


class Location(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='India')
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.city})"


class CallLog(models.Model):
    class Provider(models.TextChoices):
        RINGCENTRAL = 'ringcentral', 'RingCentral'
        MANUAL = 'manual', 'Manual'

    class Direction(models.TextChoices):
        OUTBOUND = 'outbound', 'Outbound'
        INBOUND = 'inbound', 'Inbound'

    class CallStatus(models.TextChoices):
        COMPLETED = 'completed', 'Completed'
        MISSED = 'missed', 'Missed'
        FAILED = 'failed', 'Failed'
        NO_ANSWER = 'no_answer', 'No Answer'

    candidate = models.ForeignKey(
        'candidates.Candidate', on_delete=models.CASCADE, related_name='call_logs'
    )
    phone_number = models.CharField(max_length=20)
    direction = models.CharField(max_length=10, choices=Direction.choices, default=Direction.OUTBOUND)
    duration_seconds = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=CallStatus.choices, default=CallStatus.COMPLETED)
    provider = models.CharField(max_length=20, choices=Provider.choices, default=Provider.RINGCENTRAL)
    provider_call_id = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Call to {self.candidate} ({self.status})"
