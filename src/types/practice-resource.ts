import type { PracticeTemplateType } from '@/generated/practice-template-values'

import type { Paper } from './paper'

export type PracticeResource = {
  id: string
  name: string
  type: PracticeTemplateType
  list: Paper[]
}
