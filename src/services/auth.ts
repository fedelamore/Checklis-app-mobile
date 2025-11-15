// src/services/auth.ts
const API_URL = import.meta.env.VITE_API_URL || 'https://sua-api.com';
export type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

    export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
      console.log("API_URL: ", API_URL)
      console.log('[auth] loginRequest called', { email });          // não logue senhas em produção
      
      try {
          const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json'},
            body: JSON.stringify({ email, password }),
          });

      console.log('[auth] HTTP status', res.status);

       if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('[auth] login error body', err);
            throw new Error(err?.message || 'Erro ao autenticar');
          }

          const data = (await res.json()) as LoginResponse;
          console.log('[auth] login success', data);
          return data;
        } catch (error) {
          console.error('[auth] loginRequest caught', error);
          throw error;
        }

      const data = (await response.json()) as LoginResponse;
      return data;
    }
