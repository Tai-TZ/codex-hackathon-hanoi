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

// Giọng tiếng Việt tốt nhất có trên máy: ưu tiên bản "Nâng cao" nếu đã tải trong Cài đặt.
let voicePromise: Promise<string | undefined> | null = null;

function vietnameseVoice(): Promise<string | undefined> {
  voicePromise ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const vietnamese = voices.filter((v) => v.language.toLowerCase().startsWith('vi'));
      const best = vietnamese.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? vietnamese[0];
      return best?.identifier;
    })
    .catch(() => undefined);
  return voicePromise;
}

/** Đọc to bằng giọng tiếng Việt; dừng câu đang đọc trước. */
export function say(text: string): void {
  Promise.all([Speech.stop().catch(() => undefined), vietnameseVoice()]).then(([, voice]) =>
    Speech.speak(text, { language: 'vi-VN', voice, rate: 0.85 }),
  );
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => undefined);
}

export function call(phone: string): void {
  Linking.openURL(`tel:${phone}`).catch(() => undefined);
}
