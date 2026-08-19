export const mockUser = {
  id: 'usr_neo_001',
  email: 'neo@banana.dev',
  role: 'user' as const,
  createdAt: '2026-01-09T08:00:00.000Z',
}

export const mockSession = {
  token: 'mock-token-banana-neo',
  user: mockUser,
}

export function ok<T>(data: T) {
  return {
    code: 0,
    message: 'ok',
    data,
  }
}
