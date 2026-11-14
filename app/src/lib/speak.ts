import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Linking, Platform } from 'react-native';

import { requestSpeech } from '@/lib/api';

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

/** Giọng có sẵn của máy: dùng khi chưa có mạng hoặc giọng tự nhiên bị lỗi, chậm. */
function sayOnDevice(text: string): void {
  Promise.all([Speech.stop().catch(() => undefined), vietnameseVoice()]).then(([, voice]) =>
    Speech.speak(text, { language: 'vi-VN', voice, rate: 1.0 }),
  );
}

type AudioLib = typeof import('expo-audio');
type Player = ReturnType<AudioLib['createAudioPlayer']>;

// Bản app build trước khi thêm expo-audio không có phần native: khi đó chỉ dùng giọng của máy.
let audioLib: AudioLib | null | undefined;

function loadAudio(): AudioLib | null {
  if (audioLib === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      audioLib = require('expo-audio') as AudioLib;
    } catch {
      audioLib = null;
    }
  }
  return audioLib;
}

// Câu đầu ngắn để mẹ nghe được sớm; phần còn lại tạo song song và phát nối tiếp.
const FIRST_PART_CHARS = 60;
const FIRST_PART_TIMEOUT_MS = 9_000;
const REST_TIMEOUT_MS = 25_000;
const PLAY_START_TIMEOUT_MS = 6_000;

function splitForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  let head = '';
  let index = 0;
  while (index < sentences.length && head.length < FIRST_PART_CHARS) head += sentences[index++];
  const rest = sentences.slice(index).join('').trim();
  return rest ? [head.trim(), rest] : [head.trim()];
}

// Mỗi lần gọi say() hoặc stopSpeaking() tăng số này; việc đọc cũ thấy số đổi thì tự dừng.
let turn = 0;
let player: Player | null = null;

function stopPlayer(): void {
  const current = player;
  player = null;
  try {
    current?.pause();
    current?.remove();
  } catch {
    // Player đã được giải phóng.
  }
}

function playUrl(audio: AudioLib, uri: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const current = audio.createAudioPlayer({ uri });
    player = current;
    let started = false;
    const finish = (error?: Error) => {
      clearTimeout(giveUp);
      try {
        subscription.remove();
      } catch {
        // Player đã được giải phóng cùng listener.
      }
      if (player === current) stopPlayer();
      if (error) reject(error);
      else resolve();
    };
    const giveUp = setTimeout(() => {
      if (!started) finish(new Error('Âm thanh tải chậm'));
    }, PLAY_START_TIMEOUT_MS);
    const subscription = current.addListener('playbackStatusUpdate', (status) => {
      if (status.playing) started = true;
      if (status.didJustFinish) finish();
    });
    current.play();
  });
}

/**
 * Đọc to bằng giọng tự nhiên do backend tạo; dừng câu đang đọc trước.
 * Backend lỗi, mạng chậm hay máy chưa có phần phát âm thanh thì đọc bằng giọng có sẵn của máy.
 */
export function say(text: string): void {
  const mine = ++turn;
  stopPlayer();
  const audio = loadAudio();
  if (!audio) {
    sayOnDevice(text);
    return;
  }
  Speech.stop().catch(() => undefined);
  const parts = splitForSpeech(text);
  const urls = parts.map((part, index) => requestSpeech(part, index === 0 ? FIRST_PART_TIMEOUT_MS : REST_TIMEOUT_MS));
  urls.forEach((url) => url.catch(() => undefined));

  (async () => {
    for (let index = 0; index < parts.length; index++) {
      try {
        const url = await urls[index];
        if (mine !== turn) return;
        // Phát ra loa ngoài kể cả khi máy gạt im lặng.
        await audio.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (mine !== turn) return;
        await playUrl(audio, url);
        if (mine !== turn) return;
      } catch {
        if (mine === turn) sayOnDevice(parts.slice(index).join(' '));
        return;
      }
    }
  })();
}

export function stopSpeaking(): void {
  turn++;
  stopPlayer();
  Speech.stop().catch(() => undefined);
}

export function call(phone: string): void {
  Linking.openURL(`tel:${phone}`).catch(() => undefined);
}
