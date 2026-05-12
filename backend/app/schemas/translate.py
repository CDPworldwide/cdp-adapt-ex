from pydantic import BaseModel, Field, field_validator


class TranslateRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=50)
    target_language: str = Field(min_length=2, max_length=10)
    source_language: str = Field(default="en", min_length=2, max_length=10)

    @field_validator("target_language", "source_language", mode="before")
    @classmethod
    def normalize_language_code(cls, value: str) -> str:
        return value.strip().lower()


class TranslateResponse(BaseModel):
    translations: list[str]
    source_language: str
    target_language: str
