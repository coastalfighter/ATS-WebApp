from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.InterviewViewSet, basename='interview')
router.register(r'emails', views.EmailLogViewSet, basename='email-log')

urlpatterns = [
    path('', include(router.urls)),
]
