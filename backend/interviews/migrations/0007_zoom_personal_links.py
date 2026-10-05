from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interviews', '0006_interviewfeedback_observationsheet'),
    ]

    operations = [
        migrations.AddField(
            model_name='zoomaccount',
            name='room_number',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='zoomaccount',
            name='zoom_email',
            field=models.EmailField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='zoomaccount',
            name='personal_meeting_link',
            field=models.URLField(blank=True, max_length=2048),
        ),
        migrations.AddField(
            model_name='zoomaccount',
            name='notes',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.RemoveField(
            model_name='zoomaccount',
            name='account_id',
        ),
        migrations.RemoveField(
            model_name='zoomaccount',
            name='client_id',
        ),
        migrations.RemoveField(
            model_name='zoomaccount',
            name='client_secret',
        ),
        migrations.AlterModelOptions(
            name='zoomaccount',
            options={'ordering': ['room_number']},
        ),
    ]
