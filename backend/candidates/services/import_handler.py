import csv
import io
import logging
from django.db import transaction
from candidates.models import (
    Candidate, UploadBatch, ImportRowError, CandidateActivityLog,
)
from candidates.constants import (
    BUCKET_FRESH, FRESH_NEVER_CONTACTED, ACTION_CANDIDATE_IMPORTED,
)
from .duplicate_detection import DuplicateDetectionService
from .assignment import AssignmentService

logger = logging.getLogger('ats')

REQUIRED_COLUMNS = ['first_name', 'last_name', 'email', 'phone']
OPTIONAL_COLUMNS = ['alternate_phone', 'source']

COLUMN_ALIASES = {
    'firstname': 'first_name',
    'first name': 'first_name',
    'lastname': 'last_name',
    'last name': 'last_name',
    'email address': 'email',
    'phone number': 'phone',
    'phone_number': 'phone',
    'mobile': 'phone',
    'alt_phone': 'alternate_phone',
    'alternate phone': 'alternate_phone',
    'alt phone': 'alternate_phone',
}


def normalize_header(header):
    h = header.strip().lower().replace('-', '_')
    return COLUMN_ALIASES.get(h, h)


class ImportHandler:

    @staticmethod
    def parse_csv(file_content):
        try:
            decoded = file_content.decode('utf-8-sig')
        except UnicodeDecodeError:
            decoded = file_content.decode('latin-1')
        reader = csv.DictReader(io.StringIO(decoded))
        raw_headers = reader.fieldnames or []
        header_map = {h: normalize_header(h) for h in raw_headers}
        rows = []
        for row in reader:
            normalized = {}
            for orig_key, norm_key in header_map.items():
                normalized[norm_key] = row.get(orig_key, '').strip()
            rows.append(normalized)
        return rows, [normalize_header(h) for h in raw_headers]

    @staticmethod
    def parse_xlsx(file_content):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True)
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        raw_headers = [str(h or '').strip() for h in next(rows_iter)]
        headers = [normalize_header(h) for h in raw_headers]
        rows = []
        for row_values in rows_iter:
            row_dict = {}
            for i, val in enumerate(row_values):
                if i < len(headers):
                    row_dict[headers[i]] = str(val or '').strip()
            rows.append(row_dict)
        wb.close()
        return rows, headers

    @classmethod
    def validate_headers(cls, headers):
        missing = [col for col in REQUIRED_COLUMNS if col not in headers]
        return missing

    @classmethod
    def validate_row(cls, row, row_number):
        errors = []
        if not row.get('first_name'):
            errors.append('first_name is required')
        if not row.get('last_name'):
            errors.append('last_name is required')
        if not row.get('email'):
            errors.append('email is required')
        if not row.get('phone'):
            errors.append('phone is required')
        email = row.get('email', '')
        if email and '@' not in email:
            errors.append('Invalid email format')
        return errors

    @classmethod
    @transaction.atomic
    def process_upload(cls, file_obj, uploaded_by):
        file_name = file_obj.name
        file_content = file_obj.read()

        batch = UploadBatch.objects.create(
            file_name=file_name,
            uploaded_by=uploaded_by,
            status='processing',
        )

        try:
            if file_name.lower().endswith('.xlsx'):
                rows, headers = cls.parse_xlsx(file_content)
            elif file_name.lower().endswith('.csv'):
                rows, headers = cls.parse_csv(file_content)
            else:
                batch.status = 'failed'
                batch.save()
                return batch, 'Unsupported file format. Use CSV or XLSX.'

            missing_headers = cls.validate_headers(headers)
            if missing_headers:
                batch.status = 'failed'
                batch.save()
                return batch, f"Missing required columns: {', '.join(missing_headers)}"

            batch.total_rows = len(rows)
            imported = 0
            duplicates = 0
            invalid = 0
            skipped = 0
            new_candidates = []

            for idx, row in enumerate(rows, start=2):
                row_errors = cls.validate_row(row, idx)
                if row_errors:
                    invalid += 1
                    ImportRowError.objects.create(
                        batch=batch,
                        row_number=idx,
                        error_type='validation',
                        error_message='; '.join(row_errors),
                        row_data=row,
                    )
                    continue

                full_name = f"{row.get('first_name', '')} {row.get('last_name', '')}".strip()
                is_dup, dup_ids = DuplicateDetectionService.check_row(
                    row.get('email', ''), row.get('phone', ''), full_name
                )
                if is_dup:
                    duplicates += 1
                    ImportRowError.objects.create(
                        batch=batch,
                        row_number=idx,
                        error_type='duplicate',
                        error_message=f"Duplicate of candidate(s): {dup_ids}",
                        row_data=row,
                    )
                    continue

                candidate = Candidate.objects.create(
                    first_name=row.get('first_name', ''),
                    last_name=row.get('last_name', ''),
                    email=row.get('email', ''),
                    phone=row.get('phone', ''),
                    alternate_phone=row.get('alternate_phone', ''),
                    source=row.get('source', ''),
                    current_bucket=BUCKET_FRESH,
                    current_status=FRESH_NEVER_CONTACTED,
                    upload_batch=batch,
                    created_by=uploaded_by,
                )

                CandidateActivityLog.objects.create(
                    candidate=candidate,
                    action_type=ACTION_CANDIDATE_IMPORTED,
                    new_value=f"Imported from {file_name}",
                    performed_by=uploaded_by,
                    remarks=f"Batch #{batch.id}, Row {idx}",
                )

                new_candidates.append(candidate)
                imported += 1

            if new_candidates:
                assigned, assign_errors = AssignmentService.auto_assign_candidates(
                    new_candidates, uploaded_by
                )
                for err in assign_errors:
                    logger.warning(err)

            batch.imported_count = imported
            batch.duplicate_count = duplicates
            batch.invalid_count = invalid
            batch.skipped_count = skipped
            batch.status = 'completed'
            batch.save()

            return batch, None

        except Exception as e:
            logger.exception(f"Upload processing failed for batch {batch.id}")
            batch.status = 'failed'
            batch.save()
            return batch, str(e)

    @classmethod
    def preview_upload(cls, file_obj):
        file_name = file_obj.name
        file_content = file_obj.read()
        file_obj.seek(0)

        try:
            if file_name.lower().endswith('.xlsx'):
                rows, headers = cls.parse_xlsx(file_content)
            elif file_name.lower().endswith('.csv'):
                rows, headers = cls.parse_csv(file_content)
            else:
                return None, None, 'Unsupported file format.'

            missing = cls.validate_headers(headers)
            if missing:
                return None, None, f"Missing required columns: {', '.join(missing)}"

            preview_rows = rows[:20]
            summary = {
                'total_rows': len(rows),
                'headers': headers,
                'preview_rows': preview_rows,
                'missing_headers': missing,
            }
            return summary, rows, None

        except Exception as e:
            return None, None, str(e)
