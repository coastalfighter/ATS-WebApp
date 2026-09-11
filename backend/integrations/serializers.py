from rest_framework import serializers
from .models import IntegrationCredential, EmailTemplate


class IntegrationCredentialSerializer(serializers.ModelSerializer):
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationCredential
        fields = [
            'id', 'provider', 'provider_display', 'account_label',
            'is_active', 'last_verified_at', 'created_at',
            'created_by_name',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None


class IntegrationCredentialCreateSerializer(serializers.ModelSerializer):
    credentials = serializers.DictField(write_only=True)

    class Meta:
        model = IntegrationCredential
        fields = ['provider', 'account_label', 'credentials', 'is_active']

    def create(self, validated_data):
        creds = validated_data.pop('credentials')
        instance = IntegrationCredential(**validated_data)
        instance.set_credentials(creds)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        creds = validated_data.pop('credentials', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if creds:
            instance.set_credentials(creds)
        instance.save()
        return instance


class EmailTemplateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'template_key', 'label', 'subject_template',
            'body_template', 'is_active', 'updated_by_name', 'updated_at',
        ]
        read_only_fields = ['template_key', 'label', 'updated_by_name', 'updated_at']

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None
