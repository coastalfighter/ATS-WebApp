from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        SUBADMIN = 'subadmin', 'Subadmin'
        HIRING_MANAGER = 'hiring_manager', 'Hiring Manager'
        TRAINER = 'trainer', 'Trainer'
        RECRUITER = 'recruiter', 'Recruiter'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.RECRUITER)
    phone = models.CharField(max_length=20, blank=True)
    daily_call_target = models.IntegerField(default=0)
    daily_booking_target = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN

    @property
    def is_subadmin_user(self):
        return self.role == self.Role.SUBADMIN

    @property
    def is_recruiter_user(self):
        return self.role == self.Role.RECRUITER

    @property
    def is_hiring_manager(self):
        return self.role == self.Role.HIRING_MANAGER

    @property
    def is_trainer_user(self):
        return self.role == self.Role.TRAINER

    @property
    def is_admin_or_subadmin(self):
        return self.role in (self.Role.ADMIN, self.Role.SUBADMIN)
