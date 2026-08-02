#!/usr/bin/env python3
"""Upload or update a file in a GitHub repo via the Contents API."""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


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


def resolve_local_file(local_file: str) -> Path:
    """Resolve and validate a local path before any filesystem read.

    Restricts reads to the professional-presence kit root (or PRO_PRESENCE_ROOT)
    so CLI/LLM-supplied paths cannot escape via .. or absolute paths.
    """
    allowed_root = Path(
        os.environ.get("PRO_PRESENCE_ROOT", Path(__file__).resolve().parents[1])
    ).resolve()
    if not local_file or local_file.strip() == "":
        raise ValueError("local_file is empty")

    candidate = Path(local_file).expanduser()
    # Reject null bytes / odd inputs early
    if "\x00" in str(candidate):
        raise ValueError("local_file contains NUL")

    resolved = candidate.resolve(strict=False)
    try:
        resolved.relative_to(allowed_root)
    except ValueError as exc:
        raise ValueError(
            f"Refusing path outside allowed root {allowed_root}: {local_file}"
        ) from exc

    if not resolved.is_file():
        raise ValueError(f"Not a readable file under allowed root: {local_file}")

    return resolved


def main() -> int:
    if len(sys.argv) != 5:
        print(
            "Usage: lib_put_file.py <owner> <repo> <path> <local_file>",
            file=sys.stderr,
        )
        return 2

    owner, repo, path, local_file_arg = sys.argv[1:5]

    # Validate the filesystem path before any other side effects or reads.
    try:
        local_file = resolve_local_file(local_file_arg)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    token = os.environ.get("GH_TOKEN")
    if not token:
        print("GH_TOKEN required", file=sys.stderr)
        return 2

    message = os.environ.get("COMMIT_MESSAGE", f"docs: update {path}")
    branch = os.environ.get("BRANCH", "main")
    api = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"

    status, meta = request("GET", api + f"?ref={branch}", token)
    sha = meta.get("sha") if isinstance(meta, dict) and status == 200 else None

    content_b64 = base64.b64encode(local_file.read_bytes()).decode()
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
