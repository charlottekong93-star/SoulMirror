export interface ReflectionResult {
  one_sentence: string;
  summary: string;
  insight: string;
  questions: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
