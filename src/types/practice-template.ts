import type { Paper } from '@/types/paper'

export interface PracticeTemplate {
  id: string
  name: string
  type: 'baseline' | 'mockExams' | 'pastExams' | 'aiEnhance'
  list: Paper[]
}
