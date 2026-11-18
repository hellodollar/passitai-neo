import type { PracticeTemplateType } from '@/generated/practice-template-values'
import type { Paper } from '@/types/paper'

export interface PracticeTemplate {
  id: string
  name: string
  type: PracticeTemplateType
  list: Paper[]
}
