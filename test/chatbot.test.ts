import { describe, it, expect, beforeAll } from 'vitest';
import {
  healthCheckApiV1HealthGet,
  chatCompletionsApiV1ChatsCompletionsPost,
  type OpenAiChatCompletionRequest,
} from '@pac-api/client';
import { createTestUser, type TestUser } from './helpers/auth';
import {
  API_BASE_URL,
  setAuthToken,
  clearAuthToken,
  getApiOptions,
  getRequestHeaders,
} from './setup';
import chatRequests from './fixtures/chat-requests.json';

describe('Chatbot API', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(API_BASE_URL);
    if (testUser.token) {
      setAuthToken(testUser.token);
    }
  }, 30000);

  describe('POST /api/v1/chat/completions', () => {
    it('should return a chat response (requires LLM)', async () => {
      const requestBody = { ...chatRequests.basicChatRequest };
      delete (requestBody as any).stream;

      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        ...getApiOptions(),
        body: requestBody as OpenAiChatCompletionRequest,
      });

      if (response.error) {
        console.error('Response error:', response.error);
      }

      expect(response.error).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.choices).toBeDefined();
      expect(response.data?.choices[0].message.role).toBe('assistant');
      expect(response.data?.choices[0].message.content).toBeTruthy();

      const content = response.data?.choices[0].message.content || '';
      expect(content.toLowerCase()).toMatch(/location|city|region|country/);

      console.log('✅ LLM Response (correctly asks for location):');
      console.log(content);
    });

    it('should handle conversation history (requires LLM)', async () => {
      const requestBody = { ...chatRequests.conversationHistoryRequest };
      delete (requestBody as any).stream;

      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        ...getApiOptions(),
        body: requestBody as OpenAiChatCompletionRequest,
      });

      expect(response.error).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.choices).toBeDefined();
      expect(response.data?.choices[0].message.role).toBe('assistant');

      const content = response.data?.choices[0].message.content || '';
      expect(content.length).toBeGreaterThan(50);
      expect(content.toLowerCase()).toMatch(/region|drought|africa|asia|australia|america/);

      console.log('✅ LLM Response (conversation with context):');
      console.log(content);
    });

    it('should accept requests without an auth header', async () => {
      const requestBody = { ...chatRequests.simpleTestRequest };
      delete (requestBody as any).stream;

      clearAuthToken();

      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        ...getApiOptions(false),
        body: requestBody as OpenAiChatCompletionRequest,
      });

      expect(response.error).toBeUndefined();
      expect(response.response.status).toBe(200);
      expect(response.data?.choices[0].message.role).toBe('assistant');
      expect(response.data?.choices[0].message.content).toBeTruthy();

      if (testUser.token) {
        setAuthToken(testUser.token);
      }
    });

    it('should reject invalid message format', async () => {
      const requestBody = { ...chatRequests.invalidRoleRequest };
      delete (requestBody as any).stream;

      // Use fetch instead of generated client to test server-side validation
      // (invalid role wouldn't pass TypeScript type checking in generated client)
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          ...getRequestHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.status).toBe(422);

      const errorData = await response.json();
      expect(errorData.detail).toBeDefined();
    });

    it('should validate message content length', async () => {
      const longContent = 'a'.repeat(15000);
      const longContentRequest: OpenAiChatCompletionRequest = {
        messages: [
          {
            role: 'user',
            content: longContent,
          },
        ],
      };

      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        ...getApiOptions(),
        body: longContentRequest,
        throwOnError: false,
      });

      expect(response.error).toBeDefined();
      expect([422, 500]).toContain(response.response.status);
    });

    it('should handle empty messages array', async () => {
      const requestBody = { ...chatRequests.emptyMessagesRequest };
      delete (requestBody as any).stream;

      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        ...getApiOptions(),
        body: requestBody as OpenAiChatCompletionRequest,
        throwOnError: false,
      });

      expect(response.error).toBeDefined();
      expect(response.response.status).toBeGreaterThanOrEqual(400);
    });

    it('should accept valid message with reasonable length (requires LLM)', async () => {
      const validRequest: OpenAiChatCompletionRequest = {
        messages: [
          {
            role: 'user',
            content: 'What are the main climate risks for São Paulo, Brazil?',
          },
        ],
      };

      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        ...getApiOptions(),
        body: validRequest,
        throwOnError: false,
      });

      expect(response.response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data?.choices).toBeDefined();
      expect(response.data?.choices[0].message.role).toBe('assistant');

      const content = response.data?.choices[0].message.content || '';
      expect(content.toLowerCase()).toMatch(/são paulo|hazard|risk|climate/);

      console.log('✅ LLM Response (location-specific query):');
      console.log(content);
    });

    it('should stream chat completion chunks (requires LLM)', async () => {
      const streamRequest: OpenAiChatCompletionRequest = {
        messages: [
          {
            role: 'user',
            content: 'List 3 climate hazards briefly.',
          },
        ],
      };

      // Use fetch for streaming to access raw SSE stream
      // (generated client consumes the body stream automatically)
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/completions/stream`, {
        method: 'POST',
        headers: {
          ...getRequestHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(streamRequest),
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let chunkCount = 0;
      let isDone = false;

      expect(reader).toBeDefined();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                isDone = true;
                break;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices?.[0]?.delta?.content) {
                  fullContent += parsed.choices[0].delta.content;
                  chunkCount++;
                }
              } catch (e) {
              }
            }
          }

          if (isDone) break;
        }
      }

      expect(chunkCount).toBeGreaterThan(0);
      expect(fullContent.length).toBeGreaterThan(50);
      expect(isDone).toBe(true);
      expect(fullContent.toLowerCase()).toMatch(/hazard|heat|flood|drought|climate/);

      console.log('✅ LLM Streaming Response:');
      console.log(fullContent);
      console.log(`   Received ${chunkCount} chunks`);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await healthCheckApiV1HealthGet({
        ...getApiOptions(),
      });

      expect(response.error).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('version');
    });
  });
});
