import { Directory, File, Paths } from 'expo-file-system';

export async function persistQuestionPhoto(uri: string, _base64: string | null, _mimeType: string): Promise<string> {
  const directory = new Directory(Paths.document, 'mistakeos-question-photos');
  directory.create({ idempotent: true, intermediates: true });
  const source = new File(uri);
  const extension = source.extension || '.jpg';
  const destination = new File(directory, `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`);
  await source.copy(destination);
  return destination.uri;
}

export async function resolveQuestionPhotoUri(uri: string): Promise<string> {
  return uri;
}

export async function clearQuestionPhotos(): Promise<void> {
  const directory = new Directory(Paths.document, 'mistakeos-question-photos');
  if (directory.exists) directory.delete();
}
