import type { DomainValue, ProvinceCode } from '@/generated/domain-values'

export type ScheduledExam = {
  subjectCode: string
  period: string
  examDate: string
}

export type ExamPlanSubject = {
  id: string
  code: string
  originCode: string
  name: string
  provinceCode: ProvinceCode
  credit: number
  examType: DomainValue<'examType'>
  nextExam: ScheduledExam | null
}

export type ExamPlan = {
  provinceCode: ProvinceCode
  majorCode: string
  subjectCodes: string[]
  major: {
    id: string
    code: string
    name: string
    educationLevel: DomainValue<'educationLevel'>
    requiredCredits: number
  }
  subjects: ExamPlanSubject[]
  nextExam: ScheduledExam | null
}

export type UpdateExamPlanBody = Pick<ExamPlan, 'provinceCode' | 'majorCode' | 'subjectCodes'>
