import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger('ats')


@shared_task(bind=True, max_retries=3, autoretry_for=(Exception,), retry_backoff=True)
def sync_ringcentral_call_logs(self):
    from .services.ringcentral_service import RingCentralService
    from interviews.models import CallLog
    from candidates.models import Candidate

    date_to = timezone.now()
    date_from = date_to - timedelta(days=1)

    records = RingCentralService.fetch_call_logs(date_from, date_to)
    created_count = 0

    for record in records:
        call_id = record.get('id', '')
        if not call_id:
            continue

        if CallLog.objects.filter(provider='ringcentral', provider_call_id=call_id).exists():
            continue

        to_number = ''
        from_number = ''
        if record.get('to'):
            to_number = record['to'].get('phoneNumber', '')
        if record.get('from'):
            from_number = record['from'].get('phoneNumber', '')

        phone = to_number if record.get('direction') == 'Outbound' else from_number
        direction = 'outbound' if record.get('direction') == 'Outbound' else 'inbound'

        rc_result = record.get('result', '')
        if rc_result in ('Call connected', 'Accepted'):
            call_status = 'completed'
        elif rc_result == 'Missed':
            call_status = 'missed'
        elif rc_result in ('No Answer', 'Busy'):
            call_status = 'no_answer'
        else:
            call_status = 'completed'

        candidate = None
        if phone:
            clean = phone.replace('+', '').replace('-', '').replace(' ', '')
            candidate = Candidate.objects.filter(phone__endswith=clean[-10:]).first()

        CallLog.objects.create(
            candidate=candidate,
            phone_number=phone,
            direction=direction,
            duration_seconds=record.get('duration', 0),
            status=call_status,
            provider='ringcentral',
            provider_call_id=call_id,
            notes=f'Auto-synced from RingCentral',
        )
        created_count += 1

    logger.info(f'Synced {created_count} call logs from RingCentral')
    return created_count
