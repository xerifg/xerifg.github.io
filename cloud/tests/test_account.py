import hashlib
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build"))
from account import owner_auth


class AccountTests(unittest.TestCase):
    def test_deployment_keeps_only_salted_verifier(self):
        salt = "0123456789abcdef0123456789abcdef"
        password = " test-password-123 "
        config = json.loads(owner_auth(" writer ", password, salt))
        proof = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000, 32).hex()
        self.assertEqual(config, {"username": "writer", "salt": salt, "verifier": hashlib.sha256(proof.encode()).hexdigest()})
        self.assertEqual(owner_auth("writer", password, salt), owner_auth("writer", password, salt))
        self.assertNotIn(password, json.dumps(config))
        self.assertNotIn(proof, json.dumps(config))

    def test_invalid_owner_configuration_fails_before_deployment(self):
        for username, password in [("", "long-password-123"), ("writer", "short"), ("a\nb", "long-password-123"), ("writer", "x" * 257)]:
            with self.assertRaises(ValueError):
                owner_auth(username, password, "a" * 32)
