from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

DEFAULT_PROJECT_ID = "project-bb4fd058-24e7-4ccb-b06"
DEFAULT_BUCKET = "cdp-ai-server-prompts-project-bb4fd058-24e7-4ccb-b06"
DEFAULT_KEY = "prompts/system_prompt.md"
DEFAULT_LOCATION = "US"
DEFAULT_CONTENT_TYPE = "text/markdown"
DEFAULT_CACHE_CONTROL = "no-cache, max-age=0"


def main() -> int:
    args = parse_args()
    prompt_file = args.prompt_file.expanduser().resolve()
    if not prompt_file.is_file():
        print(f"error: prompt file not found: {prompt_file}", file=sys.stderr)
        return 1

    bucket_url = f"gs://{args.bucket}"
    ensure_bucket(
        bucket_url=bucket_url,
        project_id=args.project_id,
        location=args.location,
        make_public=not args.skip_public_iam,
    )
    upload_prompt(
        prompt_file=prompt_file,
        bucket_url=bucket_url,
        key=args.key,
        project_id=args.project_id,
        content_type=args.content_type,
        cache_control=args.cache_control,
    )

    public_url = f"https://storage.googleapis.com/{args.bucket}/{args.key}"
    print(public_url)
    return 0


def parse_args() -> argparse.Namespace:
    root_dir = Path(__file__).resolve().parents[1]
    default_prompt_file = root_dir / "app" / "prompts" / "system_prompt.md"
    parser = argparse.ArgumentParser(
        description="Upload the AI system prompt to a stable public GCS URL.",
    )
    parser.add_argument(
        "--project-id",
        default=os.getenv("GCP_PROJECT_ID")
        or os.getenv("PROJECT_ID")
        or DEFAULT_PROJECT_ID,
    )
    parser.add_argument(
        "--bucket",
        default=os.getenv("SYSTEM_PROMPT_BUCKET", DEFAULT_BUCKET),
    )
    parser.add_argument(
        "--key",
        default=os.getenv("SYSTEM_PROMPT_OBJECT", DEFAULT_KEY),
    )
    parser.add_argument(
        "--location",
        default=os.getenv("SYSTEM_PROMPT_BUCKET_LOCATION", DEFAULT_LOCATION),
    )
    parser.add_argument(
        "--prompt-file",
        type=Path,
        default=Path(os.getenv("PROMPT_FILE", default_prompt_file)),
    )
    parser.add_argument(
        "--content-type",
        default=os.getenv("SYSTEM_PROMPT_CONTENT_TYPE", DEFAULT_CONTENT_TYPE),
    )
    parser.add_argument(
        "--cache-control",
        default=os.getenv("SYSTEM_PROMPT_CACHE_CONTROL", DEFAULT_CACHE_CONTROL),
    )
    parser.add_argument(
        "--skip-public-iam",
        action="store_true",
        help="Upload only; do not configure allUsers objectViewer on the bucket.",
    )
    return parser.parse_args()


def ensure_bucket(
    *,
    bucket_url: str,
    project_id: str,
    location: str,
    make_public: bool,
) -> None:
    describe = run(
        [
            "gcloud",
            "storage",
            "buckets",
            "describe",
            bucket_url,
            "--project",
            project_id,
        ],
        check=False,
    )
    if describe.returncode != 0:
        run(
            [
                "gcloud",
                "storage",
                "buckets",
                "create",
                bucket_url,
                "--project",
                project_id,
                "--location",
                location,
                "--uniform-bucket-level-access",
                "--no-public-access-prevention",
            ],
        )

    if make_public:
        run(
            [
                "gcloud",
                "storage",
                "buckets",
                "add-iam-policy-binding",
                bucket_url,
                "--project",
                project_id,
                "--member",
                "allUsers",
                "--role",
                "roles/storage.objectViewer",
            ],
        )


def upload_prompt(
    *,
    prompt_file: Path,
    bucket_url: str,
    key: str,
    project_id: str,
    content_type: str,
    cache_control: str,
) -> None:
    run(
        [
            "gcloud",
            "storage",
            "cp",
            str(prompt_file),
            f"{bucket_url}/{key}",
            "--project",
            project_id,
            "--content-type",
            content_type,
            "--cache-control",
            cache_control,
        ],
    )


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    completed = subprocess.run(command, check=False)
    if check and completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command)
    return completed


if __name__ == "__main__":
    raise SystemExit(main())
