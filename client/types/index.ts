export * from '../../shared/types.ts';

export interface AppSettings {
  model: string;
  temperature: number;
}

export interface ToastMessage {
  id: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
}

export interface QuizReviewRecord {
  questionId: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  selectedOption: 'A' | 'B' | 'C' | 'D';
  correctOption: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  explanation: string;
}
