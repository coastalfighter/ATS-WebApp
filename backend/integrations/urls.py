from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IntegrationCredentialViewSet,
    RingCentralCallView,
    RingCentralStatusView,
    SyncCallLogsView,
    EmailTemplateViewSet,
)

router = DefaultRouter()
router.register('credentials', IntegrationCredentialViewSet, basename='integration-credential')
router.register('email-templates', EmailTemplateViewSet, basename='email-template')

urlpatterns = [
    path('ringcentral/call/', RingCentralCallView.as_view(), name='ringcentral-call'),
    path('ringcentral/status/', RingCentralStatusView.as_view(), name='ringcentral-status'),
    path('ringcentral/sync/', SyncCallLogsView.as_view(), name='ringcentral-sync'),
    path('', include(router.urls)),
]
