import json
import traceback
from django.http import JsonResponse


class DebugErrorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception as exc:
            return JsonResponse(
                {
                    'error': str(exc),
                    'type': type(exc).__name__,
                    'traceback': traceback.format_exc(),
                },
                status=500,
            )
