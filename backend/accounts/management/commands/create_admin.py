from django.core.management.base import BaseCommand
from accounts.models import User


class Command(BaseCommand):
    help = 'Create the initial admin user'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='admin')
        parser.add_argument('--email', default='admin@example.com')
        parser.add_argument('--password', default='Admin@123456')
        parser.add_argument('--first-name', default='System')
        parser.add_argument('--last-name', default='Admin')

    def handle(self, *args, **options):
        if User.objects.filter(username=options['username']).exists():
            self.stdout.write(self.style.WARNING(f"User '{options['username']}' already exists."))
            return
        user = User.objects.create_superuser(
            username=options['username'],
            email=options['email'],
            password=options['password'],
            first_name=options['first_name'],
            last_name=options['last_name'],
            role='admin',
        )
        self.stdout.write(self.style.SUCCESS(
            f"Admin user '{user.username}' created successfully."
        ))
