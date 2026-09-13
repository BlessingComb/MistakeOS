// TypeScript resolves this portable fallback while Metro selects .native or .web at runtime.
export async function persistQuestionPhoto(uri: string, _base64: string | null, _mimeType: string): Promise<string> {
  return uri;
}

export async function resolveQuestionPhotoUri(uri: string): Promise<string> {
  return uri;
}

export async function clearQuestionPhotos(): Promise<void> {}
