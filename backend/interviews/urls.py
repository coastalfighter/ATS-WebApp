from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'emails', views.EmailLogViewSet, basename='email-log')
router.register(r'', views.InterviewViewSet, basename='interview')

urlpatterns = [
    path('', include(router.urls)),
]
