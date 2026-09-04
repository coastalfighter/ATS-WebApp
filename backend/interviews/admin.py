from django.contrib import admin
from .models import Interview, EmailLog


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'interview_type', 'interviewer_name', 'scheduled_at', 'status', 'created_by']
    list_filter = ['interview_type', 'status', 'scheduled_at']
    search_fields = ['candidate__first_name', 'candidate__last_name', 'interviewer_name']


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['email_type', 'recipient', 'subject', 'status', 'sent_at']
    list_filter = ['email_type', 'status', 'sent_at']
    search_fields = ['recipient', 'subject']
