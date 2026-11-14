import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Linking, Platform } from 'react-native';

/**
 * Cho tiếng đọc ra loa ngoài kể cả khi máy gạt im lặng, và không bị chuyển sang loa nghe
 * sau khi vừa thu giọng nói.
 */
export function prepareAudio(): void {
  if (Platform.OS !== 'ios') return;
  try {
    ExpoSpeechRecognitionModule.setCategoryIOS({
      category: 'playAndRecord',
      categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
      mode: 'default',
    });
  } catch {
    // Không đặt được thì vẫn đọc bằng cấu hình mặc định.
  }
}

/** Đọc to bằng giọng tiếng Việt; dừng câu đang đọc trước. */
export function say(text: string): void {
  Speech.stop()
    .catch(() => undefined)
    .then(() => Speech.speak(text, { language: 'vi-VN', rate: 0.85 }));
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => undefined);
}

export function call(phone: string): void {
  Linking.openURL(`tel:${phone}`).catch(() => undefined);
}
