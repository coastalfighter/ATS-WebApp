from django.conf import settings
from django.db import models
from core.encryption import encrypt_json, decrypt_json


class IntegrationCredential(models.Model):
    class Provider(models.TextChoices):
        ZOOM = 'zoom', 'Zoom'
        GOOGLE = 'google', 'Google Calendar'
        RINGCENTRAL = 'ringcentral', 'RingCentral'

    provider = models.CharField(max_length=20, choices=Provider.choices)
    account_label = models.CharField(max_length=200)
    _encrypted_data = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )

    class Meta:
        ordering = ['provider', 'account_label']
        unique_together = ['provider', 'account_label']

    def __str__(self):
        return f'{self.get_provider_display()} — {self.account_label}'

    def set_credentials(self, data: dict):
        self._encrypted_data = encrypt_json(data)

    def get_credentials(self) -> dict:
        if not self._encrypted_data:
            return {}
        return decrypt_json(self._encrypted_data)


class EmailTemplate(models.Model):
    template_key = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=200)
    subject_template = models.CharField(max_length=500)
    body_template = models.TextField()
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['template_key']

    def __str__(self):
        return f'{self.label} ({self.template_key})'
