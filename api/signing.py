import os, base64
from nacl.signing import SigningKey, VerifyKey

KEY_DIR = "/data/keys"
KEY_PATH = f"{KEY_DIR}/policy_signing.key"

def load_or_create_key() -> SigningKey:
    os.makedirs(KEY_DIR, exist_ok=True)
    if os.path.exists(KEY_PATH):
        with open(KEY_PATH, "rb") as f:
            raw = f.read()
            return SigningKey(raw)
    sk = SigningKey.generate()
    with open(KEY_PATH, "wb") as f:
        f.write(bytes(sk))
    return sk

def signing_key_b64() -> str:
    return base64.b64encode(bytes(load_or_create_key())).decode()

def verify_key_b64() -> str:
    vk = load_or_create_key().verify_key
    return base64.b64encode(bytes(vk)).decode()
