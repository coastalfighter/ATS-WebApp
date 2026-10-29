from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IntegrationCredentialViewSet,
    RingCentralCallView,
    LogCallView,
    RingCentralStatusView,
    SyncCallLogsView,
    RingCentralAuthorizeView,
    RingCentralCallbackView,
    RingCentralConnectionView,
    EmailTemplateViewSet,
)

router = DefaultRouter()
router.register('credentials', IntegrationCredentialViewSet, basename='integration-credential')
router.register('email-templates', EmailTemplateViewSet, basename='email-template')

urlpatterns = [
    path('ringcentral/authorize/', RingCentralAuthorizeView.as_view(), name='ringcentral-authorize'),
    path('ringcentral/callback/', RingCentralCallbackView.as_view(), name='ringcentral-callback'),
    path('ringcentral/connection/', RingCentralConnectionView.as_view(), name='ringcentral-connection'),
    path('ringcentral/call/', RingCentralCallView.as_view(), name='ringcentral-call'),
    path('ringcentral/log-call/', LogCallView.as_view(), name='ringcentral-log-call'),
    path('ringcentral/status/', RingCentralStatusView.as_view(), name='ringcentral-status'),
    path('ringcentral/sync/', SyncCallLogsView.as_view(), name='ringcentral-sync'),
    path('', include(router.urls)),
]
