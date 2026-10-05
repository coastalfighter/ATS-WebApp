from django.db import migrations, models


def backfill_is_migrated(apps, schema_editor):
    Candidate = apps.get_model('candidates', 'Candidate')
    Candidate.objects.filter(
        created_by__isnull=True,
        upload_batch__isnull=True,
    ).update(is_migrated=True)


class Migration(migrations.Migration):

    dependencies = [
        ('candidates', '0005_job_market_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='candidate',
            name='is_migrated',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.RunPython(backfill_is_migrated, migrations.RunPython.noop),
    ]
