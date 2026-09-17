"""Idempotent resource setup, run on a standard GitHub-hosted runner."""
import json
import os
from sync import Cloud, ROOT, encoded, request_json


def setup():
    # Empty ID is allowed only during discovery; no database query occurs beforehand.
    os.environ.setdefault("D1_DATABASE_ID", "")
    cloud = Cloud()
    config = json.loads((ROOT / "cloud/wrangler.jsonc").read_text(encoding="utf-8"))
    for name, default in config["vars"].items():
        value = os.getenv(name) or default
        if "\n" in value or "\r" in value:
            raise ValueError("Configuration must contain single-line values")
        config["vars"][name] = value
        os.environ[name] = value
    databases = request_json(cloud.base + "/d1/database?per_page=100", headers=cloud.headers)["result"]
    name = config["d1_databases"][0]["database_name"]
    database = next((db for db in databases if db["name"] == name), None)
    if not database:
        database = request_json(cloud.base + "/d1/database", {"name": name}, cloud.headers)["result"]
    cloud.database = database["uuid"]
    os.environ["D1_DATABASE_ID"] = cloud.database
    config["d1_databases"][0]["database_id"] = cloud.database
    indexes = request_json(cloud.base + "/vectorize/v2/indexes", headers=cloud.headers)["result"]
    index = next((item for item in indexes if item["name"] == cloud.index), None)
    if not index:
        index = request_json(cloud.base + "/vectorize/v2/indexes", {"name": cloud.index, "description": "Published notebook evidence", "config": {"dimensions": 1024, "metric": "cosine"}}, cloud.headers)["result"]
    if index.get("config", {}).get("dimensions") != 1024 or index.get("config", {}).get("metric") != "cosine":
        raise ValueError("Existing vector index has incompatible configuration; refusing to overwrite it")
    metadata = cloud.vectors("metadata_index/list", method="GET")
    if not any(item.get("propertyName") == "noteId" for item in metadata.get("metadataIndexes", [])):
        mutation = cloud.vectors("metadata_index/create", {"propertyName": "noteId", "indexType": "string"})
        cloud.wait_mutation(mutation["mutationId"])
    # CREATE IF NOT EXISTS is safe to repeat. No destructive migrations.
    schema = (ROOT / "cloud/schema.sql").read_text(encoding="utf-8")
    for statement in schema.split(";"):
        if statement.strip():
            cloud.sql(statement)
    (ROOT / "cloud/wrangler.generated.json").write_text(encoded(config), encoding="utf-8")
    if os.getenv("GITHUB_ENV"):
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
            output.write(f"D1_DATABASE_ID={cloud.database}\n")
            for key, value in config["vars"].items():
                if not key.startswith("GITHUB_"):
                    output.write(f"{key}={value}\n")
    print("Cloud resources ready; free-tier plan was not changed.")


if __name__ == "__main__":
    setup()
