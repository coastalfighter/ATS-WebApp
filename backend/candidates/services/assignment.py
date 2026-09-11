import logging
from django.db import transaction
from accounts.models import User
from candidates.models import (
    Candidate, RecruiterAssignmentHistory, CandidateActivityLog, AppSetting,
)
from candidates.constants import ACTION_CANDIDATE_ASSIGNED, ACTION_RECRUITER_CHANGED

logger = logging.getLogger('ats')


class AssignmentService:

    @staticmethod
    def get_next_recruiter():
        active_recruiters = list(
            User.objects.filter(role='recruiter', is_active=True).order_by('id')
        )
        if not active_recruiters:
            return None

        pointer_str = AppSetting.get('round_robin_pointer', '0')
        try:
            pointer = int(pointer_str)
        except ValueError:
            pointer = 0

        if pointer >= len(active_recruiters):
            pointer = 0

        selected = active_recruiters[pointer]
        new_pointer = (pointer + 1) % len(active_recruiters)

        AppSetting.objects.update_or_create(
            key='round_robin_pointer',
            defaults={'value': str(new_pointer), 'description': 'Round-robin assignment pointer'},
        )
        return selected

    @staticmethod
    @transaction.atomic
    def assign_candidate(candidate, recruiter, assigned_by, is_reassignment=False, remarks=''):
        old_recruiter = candidate.assigned_recruiter
        candidate.assigned_recruiter = recruiter
        candidate.save(update_fields=['assigned_recruiter', 'updated_at'])

        RecruiterAssignmentHistory.objects.create(
            candidate=candidate,
            from_recruiter=old_recruiter,
            to_recruiter=recruiter,
            assigned_by=assigned_by,
        )

        action = ACTION_RECRUITER_CHANGED if is_reassignment else ACTION_CANDIDATE_ASSIGNED
        default_remarks = 'Reassignment' if is_reassignment else 'Initial assignment'
        CandidateActivityLog.objects.create(
            candidate=candidate,
            action_type=action,
            old_value=old_recruiter.get_full_name() if old_recruiter else '',
            new_value=recruiter.get_full_name(),
            performed_by=assigned_by,
            remarks=remarks or default_remarks,
        )

        from notifications.services import NotificationService
        verb = 'reassigned' if is_reassignment else 'assigned'
        NotificationService.notify_and_email(
            recipient=recruiter,
            title=f'Candidate {verb} to you',
            message=f'{candidate.full_name} has been {verb} to you by {assigned_by.get_full_name()}.',
            event_type='assignment',
            category='action',
            link=f'/candidates/{candidate.id}',
        )

        return candidate

    @classmethod
    def auto_assign_candidates(cls, candidates, assigned_by):
        assigned = []
        errors = []
        for candidate in candidates:
            recruiter = cls.get_next_recruiter()
            if recruiter is None:
                errors.append(f"No active recruiter for candidate {candidate.id}")
                logger.error(f"No active recruiter available for candidate {candidate.id}")
                continue
            cls.assign_candidate(candidate, recruiter, assigned_by)
            assigned.append(candidate)
        return assigned, errors

    @classmethod
    def reassign_candidate(cls, candidate, new_recruiter, assigned_by, remarks=''):
        return cls.assign_candidate(
            candidate, new_recruiter, assigned_by, is_reassignment=True, remarks=remarks
        )

    @staticmethod
    def reset_round_robin():
        AppSetting.objects.update_or_create(
            key='round_robin_pointer',
            defaults={'value': '0', 'description': 'Round-robin assignment pointer'},
        )
