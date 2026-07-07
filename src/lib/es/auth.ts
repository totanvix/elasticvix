import type { AuthConfig } from '../types';

export function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  switch (auth.type) {
    case 'none':
      return {};
    case 'basic':
      return { Authorization: 'Basic ' + btoa(`${auth.username}:${auth.password}`) };
    case 'apiKey':
      return { Authorization: `ApiKey ${auth.apiKey}` };
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` };
  }
}
