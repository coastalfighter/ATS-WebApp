from django.contrib import admin
from .models import IntegrationCredential, EmailTemplate


@admin.register(IntegrationCredential)
class IntegrationCredentialAdmin(admin.ModelAdmin):
    list_display = ['provider', 'account_label', 'is_active', 'last_verified_at', 'created_at']
    list_filter = ['provider', 'is_active']
    search_fields = ['account_label']
    readonly_fields = ['_encrypted_data', 'created_at']


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ['template_key', 'label', 'is_active', 'updated_at']
    list_filter = ['is_active']
    search_fields = ['template_key', 'label']
