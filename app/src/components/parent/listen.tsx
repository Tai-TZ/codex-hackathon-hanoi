import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { Colors, Fonts, FontSize, riso, Spacing } from '@/constants/theme';
import { stopSpeaking } from '@/lib/speak';

/** Nút Nói: giọng nói thành chữ ngay trên máy, chữ hiện dần; bấm Gửi để gửi chữ cho agent. */
export function ListenView({ onSend, onCancel }: { onSend: (text: string) => void; onCancel: () => void }) {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    stopSpeaking();
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((permission) => {
        if (cancelled) return;
        if (!permission.granted) {
          setError('Máy chưa cho phép dùng micro. Mẹ gõ câu hỏi vào ô dưới, hoặc nhờ con bật trong Cài đặt nhé.');
          return;
        }
        ExpoSpeechRecognitionModule.start({
          lang: 'vi-VN',
          interimResults: true,
          continuous: true,
          iosCategory: {
            category: 'playAndRecord',
            categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
            mode: 'default',
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError('Chưa bật được micro. Mẹ gõ câu hỏi vào ô dưới nhé.');
      });
    return () => {
      cancelled = true;
      ExpoSpeechRecognitionModule.abort();
    };
  }, [attempt]);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (text) setTranscript(text);
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[stt]', event.error, event.message);
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    setError('Con chưa nghe rõ. Mẹ bấm "Nói lại", hoặc gõ câu hỏi vào ô dưới nhé.');
  });

  const text = transcript.trim();
  const status = listening ? 'Con đang nghe mẹ…' : text ? 'Mẹ bấm Gửi để con xem nhé' : 'Bấm nói, con nghe';

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <SonAvatar size={170} mood={listening ? 'listening' : 'idle'} />
        <Txt size={FontSize.heading} weight="bold" color={Colors.primary} center>
          {status}
        </Txt>
      </View>

      <TextInput
        value={transcript}
        onChangeText={setTranscript}
        onFocus={() => ExpoSpeechRecognitionModule.stop()}
        multiline
        placeholder="Lời mẹ nói sẽ hiện ở đây…"
        placeholderTextColor={Colors.textMuted}
        style={[riso(Colors.teal), styles.transcript]}
      />
      {error && (
        <Txt size={FontSize.parentBody} color={Colors.dangerText}>
          {error}
        </Txt>
      )}

      <View style={styles.buttons}>
        <BigButton
          label="Gửi"
          icon="paperplane.fill"
          height={110}
          fontSize={32}
          disabled={!text}
          onPress={() => {
            ExpoSpeechRecognitionModule.abort();
            onSend(text);
          }}
        />
        <View style={styles.row}>
          {!listening && (
            <BigButton
              label="Nói lại"
              icon="mic.fill"
              tone="coral"
              height={80}
              style={styles.half}
              onPress={() => {
                setError(null);
                setTranscript('');
                setAttempt((n) => n + 1);
              }}
            />
          )}
          <BigButton label="Hủy" tone="paper" height={80} style={styles.half} onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: Spacing.three },
  top: { alignItems: 'center', gap: Spacing.two },
  transcript: {
    flex: 1,
    minHeight: 120,
    backgroundColor: Colors.surface,
    padding: Spacing.three,
    fontFamily: Fonts.semibold,
    fontSize: FontSize.heading,
    lineHeight: 38,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  buttons: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
});
