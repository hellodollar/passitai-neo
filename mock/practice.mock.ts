import { defineMock } from 'vite-plugin-mock-dev-server'

import { ok } from './shared'

export default defineMock([
  {
    url: '/api/wrong-questions',
    method: 'GET',
    delay: 100,
    body: ok({ total: 0, items: [] }),
  },
  {
    url: '/api/favorites',
    method: 'GET',
    delay: 100,
    body: ok({ total: 0, items: [] }),
  },
  {
    url: '/api/answer-sheets',
    method: 'GET',
    delay: 100,
    body: ok({ total: 0, items: [] }),
  },
])
