import { apiFetch } from "./client";

export interface AuthResponse {
  token: string;
  user: { id: string; username: string };
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function signup(username: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
