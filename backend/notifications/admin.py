from django.contrib import admin
from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'recipient', 'category', 'is_read', 'created_at']
    list_filter = ['category', 'is_read', 'created_at']
    search_fields = ['title', 'message', 'recipient__username']
    raw_id_fields = ['recipient']


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'in_app_enabled', 'email_on_booking', 'email_on_assignment']
    raw_id_fields = ['user']
