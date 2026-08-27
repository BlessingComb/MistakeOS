import { parseQuestionPhotoAnalysis, type QuestionPhotoAnalysis } from '../src/analysis/core';
import type { AppLanguage } from '../src/i18n';

export type GroqAnalysisRequest = { imageBase64: string; mimeType: string; language: AppLanguage };
export type GroqAnalysisResponse = { analysis: QuestionPhotoAnalysis; model: string };

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_BASE64_LENGTH = 8_000_000;

export function validateGroqAnalysisRequest(value: unknown): GroqAnalysisRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const request = value as Record<string, unknown>;
  if (typeof request.imageBase64 !== 'string' || request.imageBase64.length === 0 || request.imageBase64.length > MAX_BASE64_LENGTH) return null;
  if (typeof request.mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(request.mimeType)) return null;
  if (request.language !== 'en' && request.language !== 'pt-BR') return null;
  return { imageBase64: request.imageBase64, mimeType: request.mimeType, language: request.language };
}

export async function analyzeWithGroq(
  request: GroqAnalysisRequest,
  apiKey: string,
  model = process.env.GROQ_MODEL?.trim() || 'qwen/qwen3.6-27b',
  fetcher: typeof fetch = fetch,
): Promise<GroqAnalysisResponse> {
  const languageName = request.language === 'pt-BR' ? 'Brazilian Portuguese' : 'English';
  const prompt = `You are the evidence-analysis engine for MistakeOS. Analyze this photo of an academic question and, when visible, the student's attempted solution or marked answer.

Return one JSON object with exactly these fields: status, transcription, errorSummary, explanation, correctionSteps, suggestedSubject, topic, suggestedCause, confidence.

Rules:
- Use only evidence visible in the image. Never invent an attempt, answer, history, grade, or certainty.
- If the image shows only the question and no attempted solution or selected answer, status must be "insufficient". Explain that the attempt must be visible.
- If an attempted solution or selected answer is visible, identify the most likely concrete error and explain the correction.
- Treat handwriting and OCR as uncertain. Use low confidence when any essential symbol is ambiguous.
- Keep errorSummary concise. Provide at most 5 short correctionSteps.
- Respond entirely in ${languageName}.
- Do not reproduce names, student IDs, school names, faces, or other personal information even if visible.
- suggestedSubject must be one of mathematics, physics, chemistry, biology, languages, other.
- topic must be a short concrete content name visible in the evidence (for example "Law of Cosines"), or an empty string if it cannot be determined. Never infer a topic from the broad subject alone.
- suggestedCause must be one of rushing, conceptRecall, questionInterpretation, calculation, startingStrategy, recurrence, uncertain.
- status must be identified or insufficient; confidence must be low, medium, or high.
- Output JSON only, without markdown.`;

  const response = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${request.mimeType};base64,${request.imageBase64}` } },
        ],
      }],
    }),
  });
  if (!response.ok) {
    const error = new Error(`Groq request failed with status ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned no structured analysis');
  const analysis = parseQuestionPhotoAnalysis(JSON.parse(text), model);
  if (!analysis) throw new Error('Groq returned an invalid analysis');
  return { analysis, model };
}
