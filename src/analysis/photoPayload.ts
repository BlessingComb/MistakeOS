export type PhotoPayload = { base64: string; mimeType: string };

export async function questionPhotoPayload(uri: string): Promise<PhotoPayload> {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(uri);
  if (!match) throw new Error('Unsupported photo URI');
  return { mimeType: match[1], base64: match[2] };
}
