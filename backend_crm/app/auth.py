import os
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet, InvalidToken

SECRET_KEY = os.getenv("SECRET_KEY", "tmsiti-crm-super-secret-key-2026-keltechnik")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 365   # 1 yil — web va mobil ilova uchun bir xil

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# SECRET_KEY'dan olingan Fernet kaliti — joriy parolni qaytarib olish uchun
# (login tekshiruvi hamon faqat bcrypt hash orqali amalga oshadi, bu shifr
# faqat superadmin xodimga parolni ko'rsatib/chop etib berishi uchun ishlatiladi).
_fernet_key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest())
_fernet = Fernet(_fernet_key)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def encrypt_password(password: str) -> str:
    return _fernet.encrypt(password.encode()).decode()


def decrypt_password(token: str) -> Optional[str]:
    try:
        return _fernet.decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
