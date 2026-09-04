import logging
from django.db import transaction
from candidates.models import Candidate, CandidateActivityLog
from candidates.constants import (
    BUCKET_FRESH, BUCKET_PIPELINE, FRESH_STATUSES, PIPELINE_STATUSES,
    FRESH_TO_PIPELINE_TRIGGER, VALID_PIPELINE_TRANSITIONS,
    PIPELINE_INTERESTED, ACTION_STATUS_CHANGED, ACTION_BUCKET_CHANGED,
)

logger = logging.getLogger('ats')


class StatusTransitionError(Exception):
    pass


class StatusTransitionService:

    @staticmethod
    def validate_fresh_status(new_status):
        if new_status not in FRESH_STATUSES:
            raise StatusTransitionError(
                f"Invalid fresh status: {new_status}"
            )

    @staticmethod
    def validate_pipeline_transition(current_status, new_status):
        if new_status not in PIPELINE_STATUSES:
            raise StatusTransitionError(
                f"Invalid pipeline status: {new_status}"
            )
        allowed = VALID_PIPELINE_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise StatusTransitionError(
                f"Cannot transition from '{current_status}' to '{new_status}'. "
                f"Allowed transitions: {allowed}"
            )

    @classmethod
    @transaction.atomic
    def update_status(cls, candidate, new_status, user, remarks='', is_admin_override=False):
        old_status = candidate.current_status
        old_bucket = candidate.current_bucket

        if old_status == new_status:
            return candidate

        if candidate.current_bucket == BUCKET_FRESH:
            cls.validate_fresh_status(new_status)

            candidate.current_status = new_status
            candidate.updated_by = user

            if new_status == FRESH_TO_PIPELINE_TRIGGER:
                candidate.current_bucket = BUCKET_PIPELINE
                candidate.current_status = PIPELINE_INTERESTED

                CandidateActivityLog.objects.create(
                    candidate=candidate,
                    action_type=ACTION_BUCKET_CHANGED,
                    old_value=BUCKET_FRESH,
                    new_value=BUCKET_PIPELINE,
                    performed_by=user,
                    remarks='Auto-moved to pipeline on Interested status',
                )

            candidate.save()

        elif candidate.current_bucket == BUCKET_PIPELINE:
            if not is_admin_override:
                cls.validate_pipeline_transition(old_status, new_status)
            candidate.current_status = new_status
            candidate.updated_by = user
            candidate.save()

        else:
            raise StatusTransitionError(
                f"Candidate is in '{candidate.current_bucket}' bucket and cannot have status changed."
            )

        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=ACTION_STATUS_CHANGED,
            old_value=old_status,
            new_value=candidate.current_status,
            performed_by=user,
            remarks=remarks or ('Admin override' if is_admin_override else ''),
        )

        return candidate
