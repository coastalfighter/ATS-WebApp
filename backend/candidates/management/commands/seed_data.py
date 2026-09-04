from django.core.management.base import BaseCommand
from accounts.models import User
from candidates.models import Candidate, CandidateActivityLog
from candidates.constants import BUCKET_FRESH, FRESH_NEVER_CONTACTED, ACTION_CANDIDATE_CREATED
from candidates.services.assignment import AssignmentService


class Command(BaseCommand):
    help = 'Seed database with sample data'

    def handle(self, *args, **options):
        admin_user = User.objects.filter(role='admin').first()
        if not admin_user:
            self.stdout.write(self.style.ERROR('No admin user found. Run create_admin first.'))
            return

        subadmin, created = User.objects.get_or_create(
            username='subadmin1',
            defaults={
                'email': 'subadmin1@example.com',
                'first_name': 'Sub',
                'last_name': 'Admin',
                'role': 'subadmin',
                'is_active': True,
            },
        )
        if created:
            subadmin.set_password('SubAdmin@123')
            subadmin.save()
            self.stdout.write(self.style.SUCCESS(f'Created subadmin: {subadmin.username}'))

        recruiters_data = [
            {'username': 'recruiter1', 'first_name': 'Alice', 'last_name': 'Johnson', 'email': 'alice@example.com'},
            {'username': 'recruiter2', 'first_name': 'Bob', 'last_name': 'Smith', 'email': 'bob@example.com'},
            {'username': 'recruiter3', 'first_name': 'Carol', 'last_name': 'Williams', 'email': 'carol@example.com'},
        ]
        for rd in recruiters_data:
            rec, created = User.objects.get_or_create(
                username=rd['username'],
                defaults={
                    'email': rd['email'],
                    'first_name': rd['first_name'],
                    'last_name': rd['last_name'],
                    'role': 'recruiter',
                    'is_active': True,
                },
            )
            if created:
                rec.set_password('Recruiter@123')
                rec.save()
                self.stdout.write(self.style.SUCCESS(f'Created recruiter: {rec.username}'))

        candidates_data = [
            {'first_name': 'John', 'last_name': 'Doe', 'email': 'john.doe@email.com', 'phone': '9876543210', 'source': 'LinkedIn'},
            {'first_name': 'Jane', 'last_name': 'Smith', 'email': 'jane.smith@email.com', 'phone': '9876543211', 'source': 'Naukri'},
            {'first_name': 'Raj', 'last_name': 'Patel', 'email': 'raj.patel@email.com', 'phone': '9876543212', 'source': 'Indeed'},
            {'first_name': 'Priya', 'last_name': 'Sharma', 'email': 'priya.sharma@email.com', 'phone': '9876543213', 'source': 'LinkedIn'},
            {'first_name': 'Mike', 'last_name': 'Wilson', 'email': 'mike.wilson@email.com', 'phone': '9876543214', 'source': 'Referral'},
            {'first_name': 'Sarah', 'last_name': 'Brown', 'email': 'sarah.brown@email.com', 'phone': '9876543215', 'source': 'Naukri'},
            {'first_name': 'Amit', 'last_name': 'Kumar', 'email': 'amit.kumar@email.com', 'phone': '9876543216', 'source': 'Indeed'},
            {'first_name': 'Lisa', 'last_name': 'Davis', 'email': 'lisa.davis@email.com', 'phone': '9876543217', 'source': 'LinkedIn'},
            {'first_name': 'David', 'last_name': 'Lee', 'email': 'david.lee@email.com', 'phone': '9876543218', 'source': 'Referral'},
            {'first_name': 'Neha', 'last_name': 'Gupta', 'email': 'neha.gupta@email.com', 'phone': '9876543219', 'source': 'Naukri'},
        ]

        new_candidates = []
        for cd in candidates_data:
            if not Candidate.objects.filter(email=cd['email']).exists():
                candidate = Candidate.objects.create(
                    first_name=cd['first_name'],
                    last_name=cd['last_name'],
                    email=cd['email'],
                    phone=cd['phone'],
                    source=cd.get('source', ''),
                    current_bucket=BUCKET_FRESH,
                    current_status=FRESH_NEVER_CONTACTED,
                    created_by=admin_user,
                )
                CandidateActivityLog.objects.create(
                    candidate=candidate,
                    action_type=ACTION_CANDIDATE_CREATED,
                    new_value=f"{candidate.full_name}",
                    performed_by=admin_user,
                    remarks='Seeded data',
                )
                new_candidates.append(candidate)
                self.stdout.write(self.style.SUCCESS(f'Created candidate: {candidate.full_name}'))

        if new_candidates:
            assigned, errors = AssignmentService.auto_assign_candidates(new_candidates, admin_user)
            self.stdout.write(self.style.SUCCESS(f'Auto-assigned {len(assigned)} candidates'))
            for err in errors:
                self.stdout.write(self.style.WARNING(err))

        self.stdout.write(self.style.SUCCESS('Seed data complete!'))
