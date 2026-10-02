from django.db import models
from django.conf import settings


class WeeklyBookingGoal(models.Model):
    location = models.ForeignKey(
        'interviews.Location', on_delete=models.CASCADE, related_name='weekly_goals'
    )
    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='weekly_booking_goals',
    )
    week_start = models.DateField(db_index=True)
    goal = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('location', 'recruiter', 'week_start')
        ordering = ['location__name', 'recruiter__first_name']

    def __str__(self):
        rec = self.recruiter.get_full_name() if self.recruiter else 'All'
        return f"{self.location.name} ({rec}) – Week of {self.week_start}: {self.goal}"
