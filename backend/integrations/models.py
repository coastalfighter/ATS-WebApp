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


class RingCentralConnection(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='rc_connection',
    )
    _encrypted_tokens = models.TextField(blank=True)
    rc_user_id = models.CharField(max_length=100, blank=True)
    rc_email = models.CharField(max_length=255, blank=True)
    rc_phone_number = models.CharField(max_length=30, blank=True)
    is_connected = models.BooleanField(default=False)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_tokens(self, access_token, refresh_token):
        self._encrypted_tokens = encrypt_json({
            'access_token': access_token,
            'refresh_token': refresh_token,
        })

    def get_tokens(self):
        if not self._encrypted_tokens:
            return '', ''
        data = decrypt_json(self._encrypted_tokens)
        return data.get('access_token', ''), data.get('refresh_token', '')

    def __str__(self):
        status = 'connected' if self.is_connected else 'disconnected'
        return f'RC Connection — {self.user.username} ({status})'
