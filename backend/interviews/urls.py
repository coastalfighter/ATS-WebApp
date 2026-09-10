from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'zoom-rooms', views.ZoomAccountViewSet, basename='zoom-room')
router.register(r'locations', views.LocationViewSet, basename='location')
router.register(r'slots', views.InterviewSlotViewSet, basename='interview-slot')
router.register(r'call-logs', views.CallLogViewSet, basename='call-log')
router.register(r'emails', views.EmailLogViewSet, basename='email-log')
router.register(r'', views.InterviewViewSet, basename='interview')

urlpatterns = [
    path('', include(router.urls)),
]
