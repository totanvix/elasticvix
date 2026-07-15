import type { AuthConfig } from '../../lib/types';

export interface AuthFormFields {
  username: string;
  password: string;
  secret: string;
}

export function initialAuthFields(auth: AuthConfig | undefined): AuthFormFields {
  if (auth?.type === 'basic') return { username: auth.username, password: auth.password, secret: '' };
  if (auth?.type === 'apiKey') return { username: '', password: '', secret: auth.apiKey };
  if (auth?.type === 'bearer') return { username: '', password: '', secret: auth.token };
  return { username: '', password: '', secret: '' };
}
