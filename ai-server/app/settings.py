import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

PROJECT_NAME = "CDP AI Server"
AI_SERVER_API_KEY_HEADER_NAME = "X-API-Key"
AI_SERVER_MODEL_NAME = "cdp-gemini"
DEFAULT_LLM_TEMPERATURE = 0.2
MAX_TOKENS = 2000
MAX_CHAT_MESSAGES = 50
MAX_CHAT_TOTAL_CHARS = 50000
MAX_CHAT_RESPONSE_CHARS = 20000
SUGGEST_FOLLOW_UPS_MAX_TOKENS = 256
LLM_REQUEST_TIMEOUT_SECONDS = 60
CORS_ALLOW_METHODS = ["GET", "POST", "OPTIONS"]
CORS_ALLOW_HEADERS = ["Authorization", "Content-Type", "X-API-Key"]


class Settings:
    def __init__(self):
        self.project_name = PROJECT_NAME
        self.api_key = os.getenv("AI_SERVER_API_KEY", os.getenv("API_KEY", ""))
        self.api_key_header_name = AI_SERVER_API_KEY_HEADER_NAME
        self.allowed_origins = _parse_list(os.getenv("ALLOWED_ORIGINS"), ["*"])
        self.allowed_methods = CORS_ALLOW_METHODS
        self.allowed_headers = CORS_ALLOW_HEADERS
        self.llm_api_key = os.getenv("LLM_API_KEY", "")
        self.llm_model = os.getenv("LLM_MODEL", "gemini-3-flash-preview")
        self.public_model_name = AI_SERVER_MODEL_NAME
        self.default_temperature = DEFAULT_LLM_TEMPERATURE
        self.max_tokens = MAX_TOKENS
        self.max_chat_messages = MAX_CHAT_MESSAGES
        self.max_chat_total_chars = MAX_CHAT_TOTAL_CHARS
        self.max_chat_response_chars = MAX_CHAT_RESPONSE_CHARS
        self.suggest_follow_ups_max_tokens = SUGGEST_FOLLOW_UPS_MAX_TOKENS
        self.llm_request_timeout_seconds = LLM_REQUEST_TIMEOUT_SECONDS
        self.mock_response = os.getenv("AI_SERVER_MOCK_RESPONSE", "")


def _parse_list(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
