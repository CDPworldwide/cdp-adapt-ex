import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.project_name = os.getenv("PROJECT_NAME", "CDP AI Server")
        self.api_key = os.getenv("AI_SERVER_API_KEY", os.getenv("API_KEY", ""))
        self.api_key_header_name = os.getenv(
            "AI_SERVER_API_KEY_HEADER_NAME",
            os.getenv("API_KEY_HEADER_NAME", "Authorization"),
        )
        self.allowed_origins = _parse_list(os.getenv("ALLOWED_ORIGINS"), ["*"])
        self.allowed_methods = _parse_list(os.getenv("CORS_ALLOW_METHODS"), ["*"])
        self.allowed_headers = _parse_list(os.getenv("CORS_ALLOW_HEADERS"), ["*"])
        self.llm_api_key = os.getenv("LLM_API_KEY", "")
        self.llm_model = os.getenv("LLM_MODEL", "gemini-3-flash-preview")
        self.public_model_name = os.getenv("AI_SERVER_MODEL_NAME", "cdp-gemini")
        self.default_temperature = float(os.getenv("DEFAULT_LLM_TEMPERATURE", "0.2"))
        self.max_tokens = int(os.getenv("MAX_TOKENS", "2000"))
        self.max_chat_messages = int(os.getenv("MAX_CHAT_MESSAGES", "50"))
        self.max_chat_total_chars = int(os.getenv("MAX_CHAT_TOTAL_CHARS", "50000"))
        self.max_chat_response_chars = int(os.getenv("MAX_CHAT_RESPONSE_CHARS", "20000"))
        self.suggest_follow_ups_max_tokens = int(
            os.getenv("SUGGEST_FOLLOW_UPS_MAX_TOKENS", "256")
        )
        self.llm_request_timeout_seconds = float(
            os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "60")
        )
        self.mock_response = os.getenv("AI_SERVER_MOCK_RESPONSE", "")


def _parse_list(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
