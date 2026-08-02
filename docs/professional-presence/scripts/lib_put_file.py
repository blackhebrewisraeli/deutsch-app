#!/usr/bin/env python3
"""Upload or update a file in a GitHub repo via the Contents API."""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request


def request(method: str, url: str, token: str, data: dict | None = None) -> tuple[int, dict | list | str]:
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "pro-presence-apply",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed: dict | list | str = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed


def main() -> int:
    if len(sys.argv) != 5:
        print(
            "Usage: lib_put_file.py <owner> <repo> <path> <local_file>",
            file=sys.stderr,
        )
        return 2

    owner, repo, path, local_file = sys.argv[1:5]
    token = os.environ.get("GH_TOKEN")
    if not token:
        print("GH_TOKEN required", file=sys.stderr)
        return 2

    message = os.environ.get("COMMIT_MESSAGE", f"docs: update {path}")
    branch = os.environ.get("BRANCH", "main")
    api = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"

    status, meta = request("GET", api + f"?ref={branch}", token)
    sha = meta.get("sha") if isinstance(meta, dict) and status == 200 else None

    content_b64 = base64.b64encode(open(local_file, "rb").read()).decode()
    payload: dict = {
        "message": message,
        "content": content_b64,
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha

    status, result = request("PUT", api, token, payload)
    if status not in (200, 201):
        print(json.dumps(result, indent=2), file=sys.stderr)
        return 1

    commit = result.get("commit", {}) if isinstance(result, dict) else {}
    print(f"OK {owner}/{repo}:{path} -> {commit.get('sha', 'committed')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
