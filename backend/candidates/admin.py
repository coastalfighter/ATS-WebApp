from django.contrib import admin
from .models import (
    Candidate, CandidateNote, CandidateActivityLog,
    UploadBatch, ImportRowError, RecruiterAssignmentHistory, AppSetting,
)


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'email', 'phone', 'current_bucket', 'current_status', 'assigned_recruiter', 'created_at']
    list_filter = ['current_bucket', 'current_status', 'assigned_recruiter', 'source']
    search_fields = ['first_name', 'last_name', 'email', 'phone']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(CandidateNote)
class CandidateNoteAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'created_by', 'created_at']
    list_filter = ['created_at']


@admin.register(CandidateActivityLog)
class CandidateActivityLogAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'action_type', 'performed_by', 'created_at']
    list_filter = ['action_type', 'created_at']
    search_fields = ['candidate__first_name', 'candidate__last_name']


@admin.register(UploadBatch)
class UploadBatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'file_name', 'uploaded_by', 'total_rows', 'imported_count', 'duplicate_count', 'status', 'created_at']
    list_filter = ['status', 'created_at']


@admin.register(ImportRowError)
class ImportRowErrorAdmin(admin.ModelAdmin):
    list_display = ['batch', 'row_number', 'error_type', 'error_message']
    list_filter = ['error_type']


@admin.register(RecruiterAssignmentHistory)
class RecruiterAssignmentHistoryAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'from_recruiter', 'to_recruiter', 'assigned_by', 'created_at']


@admin.register(AppSetting)
class AppSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'description', 'updated_at']
