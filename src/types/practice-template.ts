import type { PracticeTemplateType } from '@/generated/practice-template-values'

import type { Paper } from './paper'

export type PracticeTemplate = {
  id: string
  name: string
  type: PracticeTemplateType
  list: Paper[]
}
