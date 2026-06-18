from cryptography.fernet import Fernet, InvalidToken

from app.config import Settings


class TokenEncryptionError(Exception):
    pass


def _get_fernet(settings: Settings) -> Fernet:
    if not settings.token_encryption_key:
        raise TokenEncryptionError("TOKEN_ENCRYPTION_KEY is not configured")
    return Fernet(settings.token_encryption_key.encode())


def encrypt_token(plaintext: str, settings: Settings) -> str:
    return _get_fernet(settings).encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str, settings: Settings) -> str:
    try:
        return _get_fernet(settings).decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise TokenEncryptionError("Failed to decrypt token") from exc
