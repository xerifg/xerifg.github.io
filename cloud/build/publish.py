import base64
import os
from sync import encoded, request_json


def publish_file(path, value, message):
    repository = os.environ["GITHUB_REPOSITORY"]
    endpoint = f"https://api.github.com/repos/{repository}/contents/{path}"
    headers = {"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"], "Accept": "application/vnd.github+json"}
    sha = None
    payload = encoded(value).encode()
    try:
        existing = request_json(endpoint, headers=headers)
        if base64.b64decode(existing.get("content", "")) == payload:
            return
        sha = existing["sha"]
    except RuntimeError as error:
        if "404" not in str(error):
            raise
    data = {"message": message, "content": base64.b64encode(payload).decode()}
    if sha:
        data["sha"] = sha
    request_json(endpoint, data, headers, "PUT", attempts=1)
