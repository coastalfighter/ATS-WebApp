from django.db import migrations


TEMPLATES = [
    {
        'template_key': 'interview_confirmation',
        'label': 'Interview Confirmation',
        'subject_template': 'Interview Scheduled - {interview_type}',
        'body_template': (
            'Dear {candidate_name},\n\n'
            'Your {interview_type} interview has been scheduled.\n\n'
            'Date & Time: {scheduled_at}\n'
            'Duration: {duration} minutes\n'
            'Interviewer: {interviewer_name}\n'
            '{zoom_info}\n'
            'Please be on time and prepared.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    {
        'template_key': 'interview_cancellation',
        'label': 'Interview Cancellation',
        'subject_template': 'Interview Cancelled - {interview_type}',
        'body_template': (
            'Dear {candidate_name},\n\n'
            'We regret to inform you that your {interview_type} interview '
            'scheduled for {scheduled_at} has been cancelled.\n\n'
            'Our team will reach out to reschedule if applicable.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    {
        'template_key': 'interview_reschedule',
        'label': 'Interview Reschedule',
        'subject_template': 'Interview Rescheduled - {interview_type}',
        'body_template': (
            'Dear {candidate_name},\n\n'
            'Your {interview_type} interview has been rescheduled.\n\n'
            'New Date & Time: {scheduled_at}\n'
            'Duration: {duration} minutes\n'
            'Interviewer: {interviewer_name}\n'
            '{zoom_info}\n'
            'Please update your calendar accordingly.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    {
        'template_key': 'interview_reminder',
        'label': 'Interview Reminder',
        'subject_template': 'Reminder: {interview_type} Interview Tomorrow',
        'body_template': (
            'Dear {candidate_name},\n\n'
            'This is a reminder that your {interview_type} interview is scheduled for tomorrow.\n\n'
            'Date & Time: {scheduled_at}\n'
            'Interviewer: {interviewer_name}\n'
            '{zoom_info}\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    {
        'template_key': 'interviewer_notification',
        'label': 'Interviewer Notification',
        'subject_template': 'Interview Scheduled with {candidate_name}',
        'body_template': (
            'Dear {interviewer_name},\n\n'
            'An interview has been scheduled with {candidate_name}.\n\n'
            'Type: {interview_type}\n'
            'Date & Time: {scheduled_at}\n'
            'Duration: {duration} minutes\n'
            '{zoom_info}\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
    {
        'template_key': 'interviewer_cancellation',
        'label': 'Interviewer Cancellation',
        'subject_template': 'Interview Cancelled with {candidate_name}',
        'body_template': (
            'Dear {interviewer_name},\n\n'
            'The {interview_type} interview with {candidate_name} '
            'scheduled for {scheduled_at} has been cancelled.\n\n'
            'Best regards,\n'
            'Recruitment Team'
        ),
    },
]


def seed_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('integrations', 'EmailTemplate')
    for tpl in TEMPLATES:
        EmailTemplate.objects.update_or_create(
            template_key=tpl['template_key'],
            defaults={
                'label': tpl['label'],
                'subject_template': tpl['subject_template'],
                'body_template': tpl['body_template'],
            },
        )


def reverse_seed(apps, schema_editor):
    EmailTemplate = apps.get_model('integrations', 'EmailTemplate')
    keys = [t['template_key'] for t in TEMPLATES]
    EmailTemplate.objects.filter(template_key__in=keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_templates, reverse_seed),
    ]
