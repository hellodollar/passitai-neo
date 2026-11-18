import type { DomainValue } from '@/generated/domain-values'

export type OptionItem = {
  id: string
  code: string
  name: string
}

export type SubjectOptionItem = OptionItem & {
  examType: DomainValue<'examType'>
}
