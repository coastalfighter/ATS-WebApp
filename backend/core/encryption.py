import json
import base64
import os
from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet():
    key = getattr(settings, 'ENCRYPTION_KEY', None)
    if not key:
        raise ValueError('ENCRYPTION_KEY not configured in settings')
    if len(key) < 32:
        key = base64.urlsafe_b64encode(key.ljust(32)[:32].encode()).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plaintext):
    f = _get_fernet()
    if isinstance(plaintext, str):
        plaintext = plaintext.encode()
    return f.encrypt(plaintext).decode()


def decrypt_value(ciphertext):
    f = _get_fernet()
    if isinstance(ciphertext, str):
        ciphertext = ciphertext.encode()
    return f.decrypt(ciphertext).decode()


def encrypt_json(data):
    return encrypt_value(json.dumps(data))


def decrypt_json(ciphertext):
    return json.loads(decrypt_value(ciphertext))


def generate_encryption_key():
    return Fernet.generate_key().decode()
