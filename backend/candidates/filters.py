import django_filters
from .models import Candidate


class CandidateFilter(django_filters.FilterSet):
    first_name = django_filters.CharFilter(lookup_expr='icontains')
    last_name = django_filters.CharFilter(lookup_expr='icontains')
    email = django_filters.CharFilter(lookup_expr='icontains')
    phone = django_filters.CharFilter(lookup_expr='icontains')
    source = django_filters.CharFilter(lookup_expr='icontains')
    current_bucket = django_filters.CharFilter()
    current_status = django_filters.CharFilter()
    assigned_recruiter = django_filters.NumberFilter()
    upload_batch = django_filters.NumberFilter()
    created_after = django_filters.DateFilter(field_name='created_at', lookup_expr='gte')
    created_before = django_filters.DateFilter(field_name='created_at', lookup_expr='lte')
    follow_up_date = django_filters.DateFilter()
    follow_up_before = django_filters.DateFilter(field_name='follow_up_date', lookup_expr='lte')

    class Meta:
        model = Candidate
        fields = [
            'first_name', 'last_name', 'email', 'phone', 'source',
            'current_bucket', 'current_status', 'assigned_recruiter',
            'upload_batch', 'follow_up_date',
        ]
