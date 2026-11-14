import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_WIDTH = 1280;

// Ảnh đã thu nhỏ ở dạng base64, tra theo uri. Gửi base64 trong JSON vì fetch của Expo
// không nhận kiểu file { uri, name, type } trong FormData.
const base64ByUri = new Map<string, string>();

export function photoBase64(uri: string): string | undefined {
  return base64ByUri.get(uri);
}

/** Chụp hoặc chọn ảnh rồi thu nhỏ. Trả null nếu người dùng bấm hủy. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Máy chưa cho phép dùng máy ảnh. Mẹ nhờ con bật trong Cài đặt nhé.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const actions = asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
  const resized = await manipulateAsync(asset.uri, actions, { compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (resized.base64) base64ByUri.set(resized.uri, resized.base64);
  return resized.uri;
}
