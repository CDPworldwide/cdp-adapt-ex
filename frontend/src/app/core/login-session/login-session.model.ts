export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
}

export interface SessionResponse {
  session_id: string;
  name: string;
  token: LoginResponse;
}
