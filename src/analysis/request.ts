import type { AppLanguage } from '../i18n';

export type QuestionPhotoAnalysisRequest = Readonly<{ requestId: string }>;

export function createQuestionPhotoAnalysisRequest(
  idFactory: () => string = generateRequestId,
): QuestionPhotoAnalysisRequest {
  return Object.freeze({ requestId: idFactory() });
}

export function questionPhotoAnalysisBody(
  request: QuestionPhotoAnalysisRequest,
  photo: { base64: string; mimeType: string },
  locale: AppLanguage,
) {
  return { requestId: request.requestId, image: photo, locale };
}

function generateRequestId() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
