"""Keep credentials out of command arguments, files and build logs."""
import json
import os
import subprocess
import secrets as secure_random
from sync import Cloud, ROOT, request_json
from account import owner_auth


def deploy():
    secrets = {key: os.environ[key] for key in ("CHAT_API_KEY", "EMBEDDING_API_KEY", "GITHUB_PUBLISH_TOKEN")}
    if not all(secrets.values()):
        raise ValueError("Required model or publishing secrets are missing")
    cloud = Cloud()
    cloud.sql("INSERT OR IGNORE INTO settings(key,value) VALUES ('owner_login_salt',?)", [secure_random.token_hex(16)])
    salt = cloud.sql("SELECT value FROM settings WHERE key='owner_login_salt'")[0]["value"]
    secrets["OWNER_AUTH"] = owner_auth(os.environ["OWNER_USERNAME"], os.environ["OWNER_PASSWORD"], salt)
    # GitHub does not automatically mask derived secrets.
    if os.getenv("GITHUB_ACTIONS"):
        print("::add-mask::" + secrets["OWNER_AUTH"])
    secrets["RERANK_API_KEY"] = os.getenv("RERANK_API_KEY") or os.environ["EMBEDDING_API_KEY"]
    command = ["npx", "--yes", "wrangler@4.133.0", "--config", "wrangler.generated.json"]
    subprocess.run(command + ["deploy"], cwd=ROOT / "cloud", check=True)
    subprocess.run(command + ["secret", "bulk"], cwd=ROOT / "cloud", input=json.dumps(secrets), text=True, check=True)
    config = json.loads((ROOT / "cloud/wrangler.generated.json").read_text(encoding="utf-8"))
    base = f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID']}"
    headers = {"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"]}
    subdomain = request_json(base + "/workers/subdomain", headers=headers)["result"]["subdomain"]
    url = f"https://{config['name']}.{subdomain}.workers.dev"
    request_json(url + "/health", attempts=1)
    # Frontend config has only a public URL, never a credential.
    from publish import publish_file
    publish_file("static/cloud-config.json", {"backendUrl": url}, "chore: configure cloud knowledge endpoint")
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
            output.write(f"## Cloud knowledge service\n\n- Service: {url}\n- Sign in with the custom OWNER_USERNAME / OWNER_PASSWORD configured in Actions Secrets.\n- Publishing, AI and Wiki share this session; no GitHub token is needed in the browser.\n")


if __name__ == "__main__":
    deploy()
