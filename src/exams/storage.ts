import { ExamRecord, sortExams } from './core';

export const EXAMS_STORAGE_KEY = '@mistakeos/exams:v1';

export interface ExamStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class ExamStore {
  constructor(private readonly storage: ExamStorage) {}

  async load(): Promise<ExamRecord[]> {
    try {
      const value = await this.storage.getItem(EXAMS_STORAGE_KEY);
      if (!value) return [];
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? sortExams(parsed as ExamRecord[]) : [];
    } catch {
      return [];
    }
  }

  async add(exam: ExamRecord): Promise<ExamRecord[]> {
    const next = sortExams([...(await this.load()), exam]);
    await this.storage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async remove(id: string): Promise<ExamRecord[]> {
    const next = (await this.load()).filter((exam) => exam.id !== id);
    await this.storage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async replaceAll(exams: readonly ExamRecord[]): Promise<ExamRecord[]> {
    const next = sortExams(exams);
    await this.storage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}
