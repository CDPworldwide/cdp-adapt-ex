from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=50)
    target_language: str = Field(min_length=2, max_length=10)
    source_language: str = Field(default="en", min_length=2, max_length=10)


class TranslateResponse(BaseModel):
    translations: list[str]
    source_language: str
    target_language: str
