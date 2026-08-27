import { resolveQuestionPhotoUri } from '../mistakes/photoStorage';

export type PhotoPayload = { base64: string; mimeType: string };

export async function questionPhotoPayload(uri: string): Promise<PhotoPayload> {
  const resolvedUri = await resolveQuestionPhotoUri(uri);
  const match = /^data:([^;]+);base64,(.+)$/s.exec(resolvedUri);
  if (match) return { mimeType: match[1], base64: match[2] };
  const response = await fetch(resolvedUri);
  if (!response.ok) throw new Error('Photo unavailable');
  const blob = await response.blob();
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < buffer.length; offset += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(offset, offset + 0x8000));
  }
  return { mimeType: blob.type || 'image/jpeg', base64: btoa(binary) };
}
