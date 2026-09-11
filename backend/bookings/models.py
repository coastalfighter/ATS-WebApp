from django.db import models
from django.conf import settings


class Booking(models.Model):
    class BookingStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'
        NO_SHOW = 'no_show', 'No Show'

    class Round(models.TextChoices):
        ROUND_1 = 'round_1', 'Round 1'
        ROUND_2 = 'round_2', 'Round 2'

    candidate = models.ForeignKey(
        'candidates.Candidate', on_delete=models.CASCADE, related_name='bookings'
    )
    interview_slot = models.ForeignKey(
        'interviews.InterviewSlot', on_delete=models.CASCADE, related_name='bookings'
    )
    booked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_bookings'
    )
    status = models.CharField(
        max_length=20, choices=BookingStatus.choices, default=BookingStatus.PENDING
    )
    round = models.CharField(
        max_length=10, choices=Round.choices, default=Round.ROUND_1
    )
    interview = models.OneToOneField(
        'interviews.Interview', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='booking'
    )
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['interview_slot', 'status']),
            models.Index(fields=['candidate', 'status']),
        ]

    def __str__(self):
        return f"Booking: {self.candidate} → {self.interview_slot} ({self.status})"


class BookingActivityLog(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=50)
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} on Booking #{self.booking_id}"
