import { defineMock } from 'vite-plugin-mock-dev-server'

import { mockSession, ok } from './shared'

export default defineMock([
  {
    url: '/api/login',
    method: 'POST',
    delay: 240,
    body: ok(mockSession),
  },
  {
    url: '/api/register',
    method: 'POST',
    delay: 320,
    body: ok(mockSession),
  },
  {
    url: '/api/user',
    method: 'GET',
    body: ok(mockSession.user),
  },
  {
    url: '/api/logout',
    method: 'POST',
    body: ok(null),
  },
])
