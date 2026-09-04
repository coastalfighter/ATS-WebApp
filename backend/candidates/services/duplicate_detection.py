from django.conf import settings
from django.db.models import Q
from candidates.models import Candidate


class DuplicateDetectionService:

    @staticmethod
    def get_strategy():
        return getattr(settings, 'DUPLICATE_DETECTION_STRATEGY', 'email')

    @classmethod
    def is_duplicate(cls, email, phone, full_name=''):
        strategy = cls.get_strategy()
        if strategy == 'email':
            return Candidate.objects.filter(email__iexact=email).exists()
        elif strategy == 'phone':
            return Candidate.objects.filter(phone=phone).exists()
        elif strategy == 'email_and_name':
            return Candidate.objects.filter(
                Q(email__iexact=email) |
                Q(phone=phone) |
                Q(email__iexact=email, first_name__iexact=full_name.split()[0] if full_name else '')
            ).exists()
        return Candidate.objects.filter(
            Q(email__iexact=email) | Q(phone=phone)
        ).exists()

    @classmethod
    def find_duplicates(cls, email, phone, full_name=''):
        strategy = cls.get_strategy()
        if strategy == 'email':
            return Candidate.objects.filter(email__iexact=email)
        elif strategy == 'phone':
            return Candidate.objects.filter(phone=phone)
        elif strategy == 'email_and_name':
            return Candidate.objects.filter(
                Q(email__iexact=email) | Q(phone=phone)
            )
        return Candidate.objects.filter(
            Q(email__iexact=email) | Q(phone=phone)
        )

    @classmethod
    def check_row(cls, email, phone, full_name=''):
        if not email and not phone:
            return False, []
        duplicates = cls.find_duplicates(email, phone, full_name)
        return duplicates.exists(), list(duplicates.values_list('id', flat=True))
