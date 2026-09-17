"""Derive the owner credential during deployment, never on the free Worker CPU."""
import hashlib
import json


def owner_auth(username, password, salt):
    username = username.strip()
    if not username or len(username) > 80 or any(ord(c) < 32 for c in username):
        raise ValueError("OWNER_USERNAME must contain 1-80 characters")
    if not 12 <= len(password) <= 256:
        raise ValueError("OWNER_PASSWORD must contain 12-256 characters")
    proof = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 600000, 32).hex()
    return json.dumps({"username": username, "salt": salt, "verifier": hashlib.sha256(proof.encode("ascii")).hexdigest()})
