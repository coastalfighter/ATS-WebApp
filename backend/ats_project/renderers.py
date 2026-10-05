import json

from rest_framework.renderers import JSONRenderer

MAX_SAFE_INT = 2**53 - 1


def _safe_ints(obj):
    if isinstance(obj, dict):
        return {k: _safe_ints(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_safe_ints(item) for item in obj]
    elif isinstance(obj, int) and not isinstance(obj, bool) and abs(obj) > MAX_SAFE_INT:
        return str(obj)
    return obj


class SafeIntJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        data = _safe_ints(data)
        return super().render(data, accepted_media_type, renderer_context)
