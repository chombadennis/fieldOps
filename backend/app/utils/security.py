import logging
from cryptography.fernet import Fernet
from ..core.config import settings

logger = logging.getLogger(__name__)

# Ensure we have a valid Fernet key
_key = settings.ENCRYPTION_KEY
if not _key:
    logger.warning("ENCRYPTION_KEY is not set in environment settings! Generating a transient key for this session...")
    _key = Fernet.generate_key().decode()
else:
    try:
        # Validate if key is a valid Fernet key
        Fernet(_key.encode())
    except Exception as e:
        logger.error(f"Provided ENCRYPTION_KEY is invalid: {e}. Generating a fallback transient key...")
        _key = Fernet.generate_key().decode()

fernet = Fernet(_key.encode())

def encrypt_token(plain_text: str) -> str:
    """
    Encrypts a plain-text token.
    """
    if not plain_text:
        return ""
    return fernet.encrypt(plain_text.encode()).decode()

def decrypt_token(cipher_text: str) -> str:
    """
    Decrypts an encrypted token.
    """
    if not cipher_text:
        return ""
    return fernet.decrypt(cipher_text.encode()).decode()
