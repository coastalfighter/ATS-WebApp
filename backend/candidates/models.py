from django.db import models
from django.conf import settings
from .constants import (
    BUCKET_CHOICES, BUCKET_UPLOAD_QUEUE, ALL_STATUS_CHOICES,
    FRESH_NEVER_CONTACTED, ACTION_CHOICES,
)


class UploadBatch(models.Model):
    file_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='upload_batches'
    )
    total_rows = models.IntegerField(default=0)
    imported_count = models.IntegerField(default=0)
    duplicate_count = models.IntegerField(default=0)
    invalid_count = models.IntegerField(default=0)
    skipped_count = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')],
        default='processing',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Upload batches'

    def __str__(self):
        return f"Batch #{self.id} - {self.file_name} ({self.created_at:%Y-%m-%d})"


class ImportRowError(models.Model):
    batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name='row_errors')
    row_number = models.IntegerField()
    error_type = models.CharField(max_length=50)
    error_message = models.TextField()
    row_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['row_number']

    def __str__(self):
        return f"Row {self.row_number}: {self.error_type}"


class Candidate(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=20, db_index=True)
    alternate_phone = models.CharField(max_length=20, blank=True)
    source = models.CharField(max_length=100, blank=True)
    residential_location = models.CharField(max_length=200, blank=True)
    job_market = models.CharField(max_length=200, blank=True)
    current_bucket = models.CharField(
        max_length=20, choices=BUCKET_CHOICES, default=BUCKET_UPLOAD_QUEUE, db_index=True
    )
    current_status = models.CharField(
        max_length=30, choices=ALL_STATUS_CHOICES, default=FRESH_NEVER_CONTACTED, db_index=True
    )
    assigned_recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_candidates'
    )
    assigned_trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='trained_candidates'
    )
    date_of_birth = models.DateField(null=True, blank=True)
    experience_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    current_company = models.CharField(max_length=200, blank=True)
    current_designation = models.CharField(max_length=200, blank=True)
    upload_batch = models.ForeignKey(
        UploadBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidates'
    )
    notes = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_candidates'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='updated_candidates'
    )
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['current_bucket', 'current_status']),
            models.Index(fields=['assigned_recruiter', 'current_bucket']),
            models.Index(fields=['email', 'phone']),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class CandidateNote(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='candidate_notes')
    note = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note for {self.candidate} at {self.created_at}"


class CandidateActivityLog(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='activity_logs')
    action_type = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['candidate', '-created_at']),
        ]

    def __str__(self):
        return f"{self.action_type} on {self.candidate} by {self.performed_by}"


class RecruiterAssignmentHistory(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='assignment_history')
    from_recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assignments_from'
    )
    to_recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='assignments_to'
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='assignments_made'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.candidate} -> {self.to_recruiter}"


class AppSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key}: {self.value}"

    @classmethod
    def get(cls, key, default=''):
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default


class FastGemUpload(models.Model):
    UPLOAD_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('uploaded', 'Uploaded'),
        ('failed', 'Failed'),
    ]

    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='fastgem_uploads')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='fastgem_uploads'
    )
    upload_data = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=UPLOAD_STATUS_CHOICES, default='pending')
    external_reference_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"FastGem #{self.id} - {self.candidate} ({self.status})"
