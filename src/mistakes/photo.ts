import * as ImagePicker from 'expo-image-picker';
import { persistQuestionPhoto } from './photoStorage';

export type QuestionPhotoSource = 'camera' | 'library';

export type QuestionPhotoResult =
  | { status: 'selected'; uri: string }
  | { status: 'cancelled' }
  | { status: 'permission-denied' }
  | { status: 'error' };

export async function selectQuestionPhoto(source: QuestionPhotoSource): Promise<QuestionPhotoResult> {
  try {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'permission-denied' };

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.82,
      // The browser keeps the selected asset as a URI. Storing its Base64 data
      // in AsyncStorage can exceed localStorage quota and prevent the mistake
      // record itself from being saved.
      base64: false,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return { status: 'cancelled' };

    const asset = result.assets[0];
    const uri = await persistQuestionPhoto(asset.uri, asset.base64 ?? null, asset.mimeType ?? 'image/jpeg');
    return { status: 'selected', uri };
  } catch {
    return { status: 'error' };
  }
}
