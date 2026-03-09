import { requestJson } from './http';

export interface AuthSession {
  user: {
    id: string;
    email: string;
    createdAt: number;
  };
}

export interface AuthRequestPayload {
  email: string;
  password: string;
  turnstileToken?: string | null;
}

export const authClient = {
  async getSession() {
    try {
      const response = await requestJson<AuthSession>('session', '/api/auth/session');
      return response.data;
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status: number | null }).status === 401) {
        return null;
      }
      throw error;
    }
  },

  async signUp(email: string, password: string, turnstileToken?: string | null) {
    const response = await requestJson<AuthSession>('sign-up', '/api/auth/sign-up', {
      body: { email, password, turnstileToken } satisfies AuthRequestPayload,
    });
    return response.data;
  },

  async signIn(email: string, password: string, turnstileToken?: string | null) {
    const response = await requestJson<AuthSession>('sign-in', '/api/auth/sign-in', {
      body: { email, password, turnstileToken } satisfies AuthRequestPayload,
    });
    return response.data;
  },

  async signOut() {
    await requestJson('sign-out', '/api/auth/sign-out', { method: 'POST' });
  },
};
