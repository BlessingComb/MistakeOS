import { File } from 'expo-file-system';

export type PhotoPayload = { base64: string; mimeType: string };

export async function questionPhotoPayload(uri: string): Promise<PhotoPayload> {
  const file = new File(uri);
  if (!file.exists) throw new Error('Photo unavailable');
  return { base64: await file.base64(), mimeType: file.type || mimeTypeForExtension(file.extension) };
}

function mimeTypeForExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.webp') return 'image/webp';
  if (normalized === '.heic' || normalized === '.heif') return 'image/heic';
  return 'image/jpeg';
}
