export interface TestUser {
  email: string;
  password: string;
  token?: string;
}

export async function registerUser(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.detail?.includes('already registered')) {
      return null;
    }
    if (error.detail?.includes('per 1 hour')) {
      console.warn('⚠️  Rate limit hit - user may already exist, will attempt login');
      return null;
    }
    throw new Error(`Registration failed: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

export async function loginUser(baseUrl: string, email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  formData.append('grant_type', 'password');

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function createTestUser(_baseUrl: string): Promise<TestUser> {
  const email = process.env.TEST_USER_EMAIL || 'test-user@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestUser123!';
  const token = process.env.TEST_AUTH_TOKEN || 'bypass-token';

  return { email, password, token };
}
