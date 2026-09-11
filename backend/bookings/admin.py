from django.contrib import admin
from .models import Booking, BookingActivityLog


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'candidate', 'interview_slot', 'status', 'round', 'booked_by', 'created_at']
    list_filter = ['status', 'round', 'created_at']
    search_fields = ['candidate__first_name', 'candidate__last_name', 'candidate__email']
    raw_id_fields = ['candidate', 'interview_slot', 'booked_by', 'interview']


@admin.register(BookingActivityLog)
class BookingActivityLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'booking', 'action', 'performed_by', 'created_at']
    list_filter = ['action', 'created_at']
