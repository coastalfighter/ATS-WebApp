from django.urls import path
from . import views

urlpatterns = [
    path('recruiter/', views.RecruiterDashboardView.as_view(), name='recruiter-dashboard'),
    path('admin/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
]
