import { defineMock } from 'vite-plugin-mock-dev-server'

import { mockMajors, mockSubjects, ok } from './shared'

function filterOptions(
  options: Array<{ id: string; code: string; name: string; majorId?: string }>,
  query: Record<string, unknown>,
) {
  const singleCode = query.code as string | undefined
  const majorId = query.majorId as string | undefined

  return options
    .filter((option) => (singleCode ? option.code === singleCode : true))
    .filter((option) => (majorId ? option.majorId === majorId : true))
    .map(({ id, code, name }) => ({ id, code, name }))
}

export default defineMock([
  {
    url: '/api/options/majors',
    method: 'GET',
    delay: 100,
    body: ({ query }) => ok(filterOptions(mockMajors, query ?? {})),
  },

  {
    url: '/api/options/subjects',
    method: 'GET',
    delay: 100,
    body: ({ query }) => ok(filterOptions(mockSubjects, query ?? {})),
  },
])
