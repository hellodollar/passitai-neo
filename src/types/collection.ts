/** 收藏与错题列表共用的筛选和聚合数据。 */
export type CollectionSource = 'favorites' | 'mistakes'
export type CollectionGroupBy = 'subject' | 'paper'
export type CollectionOrder = 'desc' | 'asc'

/** 收藏或记错请求携带题目、科目及发生题集。 */
export type CollectionContext = {
  questionId: string
  subjectId: string
  paperId: string
}

export type FavoriteMutationResult = {
  favId: string
}

export type CollectionAggregate = {
  items: CollectionAggregateItem[]
  totalQuestionCount: number
}

export type CollectionAggregateItem = {
  subjectId: string
  subjectName: string
  questionCount: number
  lastCollectedAt: string
  paperId?: string
  paperName?: string
}
