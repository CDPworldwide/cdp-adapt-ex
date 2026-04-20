# LLM Integration

The backend integrates with Google's Gemini LLM (using the `google-genai` SDK) for AI-powered chat and follow-up suggestions.

## GeminiLLMClient

The `GeminiLLMClient` provides an interface to Google's Gemini API. It handles model configuration, system prompt injection, and structured output (JSON).

### Configuration

The client is configured using the following environment variables:

| Variable | Description |
|----------|-------------|
| `LLM_API_KEY` | Google AI API Key |
| `LLM_MODEL` | Model name (e.g., `gemini-2.0-flash`) |
| `DEFAULT_LLM_TEMPERATURE` | Default randomness for responses |

### System Prompts

System prompts are stored as markdown files in `backend/app/utils/prompts/`. The `GeminiLLMClient` injects these via the `system_instruction` parameter in the `GenerateContentConfig`.

- **chatbot.md:** Used for general climate-related chat.
- **suggest_follow_ups.md:** Used for generating follow-up questions.

## SuggestFollowUps Service

The `SuggestFollowUps` core service implements the logic for generating relevant follow-up questions based on the current chat context and location data.

### Selection Logic

1. **Candidate Retrieval:** Loads a catalog of "approved" follow-up questions.
2. **Lexical Overlap:** Ranks candidates based on keyword overlap with the latest user query.
3. **Bias Boosting:** Applies boosts for certain keywords (e.g., "hazards", "actions").
4. **LLM Selection:** Sends the top candidates to Gemini to select the most appropriate 3 questions to display.

## Chat Completions

The `/chats/completions` endpoint provides an OpenAI-compatible interface for multi-turn conversations. It uses `prepare_contents` to convert chat messages into the format expected by the Gemini API.

### Input Sanitization

Before sending location data to the LLM, geometry information (GeoJSON) is stripped to reduce token usage and improve performance, as the LLM only needs textual context.

## Usage Pattern

```python
from app.services.impls.gemini_client import gemini_service

# Request follow-ups
service = SuggestFollowUps(gemini_service)
response = await service.suggest_follow_ups_async(chat_request)
```
