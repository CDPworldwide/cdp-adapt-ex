from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_GIST_ID = "fa841de953aed344794b1fc0281069d1"
DEFAULT_GIST_FILE_NAME = "system_prompt.md"
DEFAULT_GIST_OWNER = "andrewm-bakerst"


def main() -> int:
    args = parse_args()
    prompt_file = args.prompt_file.expanduser().resolve()
    if not prompt_file.is_file():
        print(f"error: prompt file not found: {prompt_file}", file=sys.stderr)
        return 1

    token = args.token or get_github_token()
    if not token:
        print(
            "error: GitHub token required. Set AI_SYSTEM_PROMPT_GIST_TOKEN, "
            "GIST_TOKEN, GH_TOKEN, or authenticate with gh.",
            file=sys.stderr,
        )
        return 1

    update_gist(
        gist_id=args.gist_id,
        file_name=args.gist_file_name,
        content=prompt_file.read_text(encoding="utf-8"),
        token=token,
    )
    print(raw_gist_url(args.gist_owner, args.gist_id, args.gist_file_name))
    return 0


def parse_args() -> argparse.Namespace:
    root_dir = Path(__file__).resolve().parents[1]
    default_prompt_file = root_dir / "app" / "prompts" / "system_prompt.md"
    parser = argparse.ArgumentParser(
        description="Upload the AI system prompt to a stable public Gist raw URL.",
    )
    parser.add_argument(
        "--gist-id",
        default=os.getenv("SYSTEM_PROMPT_GIST_ID", DEFAULT_GIST_ID),
    )
    parser.add_argument(
        "--gist-file-name",
        default=os.getenv("SYSTEM_PROMPT_GIST_FILE_NAME", DEFAULT_GIST_FILE_NAME),
    )
    parser.add_argument(
        "--gist-owner",
        default=os.getenv("SYSTEM_PROMPT_GIST_OWNER", DEFAULT_GIST_OWNER),
    )
    parser.add_argument(
        "--prompt-file",
        type=Path,
        default=Path(os.getenv("PROMPT_FILE", default_prompt_file)),
    )
    parser.add_argument(
        "--token",
        default=None,
        help="GitHub token with gist scope. Defaults to env vars or gh auth.",
    )
    return parser.parse_args()


def get_github_token() -> str:
    for env_var in (
        "AI_SYSTEM_PROMPT_GIST_TOKEN",
        "GIST_TOKEN",
        "GH_TOKEN",
        "GITHUB_TOKEN",
    ):
        token = os.getenv(env_var)
        if token:
            return token

    try:
        completed = subprocess.run(
            ["gh", "auth", "token"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return ""
    if completed.returncode != 0:
        return ""
    return completed.stdout.strip()


def update_gist(
    *,
    gist_id: str,
    file_name: str,
    content: str,
    token: str,
) -> None:
    payload = json.dumps({"files": {file_name: {"content": content}}}).encode()
    request = urllib.request.Request(
        f"https://api.github.com/gists/{gist_id}",
        data=payload,
        method="PATCH",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status >= 300:
                raise RuntimeError(f"GitHub API returned HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API returned HTTP {exc.code}: {body}") from exc


def raw_gist_url(owner: str, gist_id: str, file_name: str) -> str:
    return f"https://gist.githubusercontent.com/{owner}/{gist_id}/raw/{file_name}"


if __name__ == "__main__":
    raise SystemExit(main())
