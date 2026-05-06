import { beforeAll, describe, expect, it } from 'vitest';

const API_BASE_URL = process.env.AI_SERVER_BASE_URL || 'http://127.0.0.1:8088';
const API_KEY_HEADER_NAME = process.env.API_KEY_HEADER_NAME || 'X-API-Key';
const API_KEY =
  process.env.AI_SERVER_API_KEY ||
  process.env.API_KEY ||
  'a71dbcb7b0188e98e296710d38e53592e075d416f675b1115b9e6aa62976aea0';

function getRequestHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
    headers[API_KEY_HEADER_NAME] = API_KEY;
  }

  return headers;
}

beforeAll(() => {
  console.log(`\n🔧 AI server test setup: API Base URL = ${API_BASE_URL}\n`);
});

describe('AI Server Chatbot API', () => {
  it('should return healthy status', async () => {
    const response = await fetch(`${API_BASE_URL}/healthz`, {
      headers: getRequestHeaders(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'healthy',
      model: 'cdp-gemini',
    });
  });

  it('should reject invalid message format', async () => {
    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'invalid_role', content: 'test' }],
      }),
    });

    expect(response.status).toBe(422);
    const errorData = await response.json();
    expect(errorData.detail).toBeDefined();
  });

  it('should return a chat response for George Local Municipality', async () => {
    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        model: 'cdp-gemini',
        messages: [
          {
            role: 'user',
            content: 'What are the primary climate hazards facing George Local Municipality?',
          },
        ],
        locationData: {
          organizationId: 834142,
        },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices?.[0]?.message?.role).toBe('assistant');
    expect(data.choices?.[0]?.message?.content).toMatch(/George Local Municipality/i);
    expect(data.choices?.[0]?.message?.content).toMatch(/hazard|flood|drought|fire/i);
  });

  it('should handle conversation history for George Local Municipality', async () => {
    const firstTurnResponse = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        model: 'cdp-gemini',
        messages: [
          {
            role: 'user',
            content:
              'What actions are being taken in George Local Municipality to address Coastal Flooding?',
          },
        ],
        locationData: {
          organizationId: 834142,
        },
      }),
    });

    expect(firstTurnResponse.status).toBe(200);
    const firstTurnData = await firstTurnResponse.json();
    const firstContent = firstTurnData.choices?.[0]?.message?.content || '';
    expect(firstContent).toBeTruthy();

    const secondTurnResponse = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        model: 'cdp-gemini',
        messages: [
          {
            role: 'user',
            content:
              'What actions are being taken in George Local Municipality to address Coastal Flooding?',
          },
          {
            role: 'assistant',
            content: firstContent,
          },
          {
            role: 'user',
            content: 'What hazards does this location face in severity order?',
          },
        ],
        locationData: {
          organizationId: 834142,
        },
      }),
    });

    expect(secondTurnResponse.status).toBe(200);
    const secondTurnData = await secondTurnResponse.json();
    expect(secondTurnData.choices?.[0]?.message?.role).toBe('assistant');
    expect(secondTurnData.choices?.[0]?.message?.content).toMatch(/hazard|flood|drought|fire/i);
  });

  it('should return follow-up questions', async () => {
    const response = await fetch(`${API_BASE_URL}/v1/suggest-follow-ups`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'What climate projects in George Local Municipality are seeking funding?',
          },
        ],
        locationData: {
          organizationId: 834142,
        },
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.follow_up_questions)).toBe(true);
    expect(data.follow_up_questions.length).toBe(3);
  });
});
