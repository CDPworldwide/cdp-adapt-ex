from typing import Annotated

from pydantic import BaseModel, Field

FollowUpQuestion = Annotated[str, Field(min_length=1, max_length=120)]


class SuggestFollowUpsResponse(BaseModel):
    follow_up_questions: list[FollowUpQuestion] = Field(min_length=1, max_length=3)
