from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.CandidateViewSet, basename='candidate')
router.register(r'batches', views.UploadBatchViewSet, basename='upload-batch')
router.register(r'settings', views.AppSettingViewSet, basename='app-setting')

urlpatterns = [
    path('upload/', views.UploadView.as_view(), name='upload'),
    path('upload/preview/', views.UploadPreviewView.as_view(), name='upload-preview'),
    path('activity-log/', views.ActivityLogListView.as_view(), name='activity-log'),
    path('', include(router.urls)),
]
