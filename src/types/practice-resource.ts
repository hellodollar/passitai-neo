import type { PracticeResourceType } from '@/generated/practice-resource-values'

import type { Paper } from './paper'

export type PracticeResource = {
  id: string
  name: string
  type: PracticeResourceType
  list: Paper[]
}
