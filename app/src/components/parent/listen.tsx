import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { Colors, Fonts, FontSize, riso, Spacing } from '@/constants/theme';
import { stopSpeaking } from '@/lib/speak';

// Mẹ nói xong thì tự gửi sau vài giây, không bắt mẹ tìm nút Gửi.
const AUTO_SEND_SECONDS = 3;

/** Nút Nói: giọng nói thành chữ ngay trên máy, chữ hiện dần; nói xong tự gửi cho agent. */
export function ListenView({ onSend, onCancel }: { onSend: (text: string) => void; onCancel: () => void }) {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Mẹ đã chạm vào ô chữ để sửa: không tự gửi nữa, chờ mẹ bấm Gửi.
  const edited = useRef(false);
  const heard = useRef('');

  useEffect(() => {
    let cancelled = false;
    stopSpeaking();
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((permission) => {
        if (cancelled) return;
        if (!permission.granted) {
          setProblem('Máy chưa cho con nghe. Mẹ nhờ con bật micro nhé.');
          return;
        }
        ExpoSpeechRecognitionModule.start({
          lang: 'vi-VN',
          interimResults: true,
          // Không nghe liên tục: mẹ ngừng nói thì máy tự dừng nghe và gửi.
          continuous: false,
          iosCategory: {
            category: 'playAndRecord',
            categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
            mode: 'default',
          },
        });
      })
      .catch(() => {
        if (!cancelled) setProblem('Con chưa nghe được. Mẹ bấm Nói lại nhé.');
      });
    return () => {
      cancelled = true;
      ExpoSpeechRecognitionModule.abort();
    };
  }, [attempt]);

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (heard.current.trim() && !edited.current) setCountdown(AUTO_SEND_SECONDS);
    else if (!heard.current.trim()) setProblem((p) => p ?? 'Con chưa nghe thấy. Mẹ bấm Nói lại, nói to hơn chút nhé.');
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (text) {
      heard.current = text;
      setTranscript(text);
      setProblem(null);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[stt]', event.error, event.message);
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    setProblem(
      event.error === 'service-not-allowed' || event.error === 'language-not-supported'
        ? 'Máy này chưa nghe được tiếng Việt. Mẹ gõ vào ô dưới, hoặc gọi con nhé.'
        : 'Con chưa nghe rõ. Mẹ bấm Nói lại nhé.',
    );
  });

  const text = transcript.trim();

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onSend(text);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onSend, text]);

  const stopAutoSend = () => {
    edited.current = true;
    setCountdown(null);
  };

  // Một dòng trạng thái duy nhất nói mẹ cần làm gì tiếp; không dùng màu đỏ để mẹ khỏi nghĩ mình làm sai.
  const status = listening
    ? 'Con đang nghe mẹ…'
    : countdown !== null
      ? `Con xem ngay sau ${countdown} giây…`
      : text
        ? 'Mẹ bấm Gửi để con xem nhé'
        : (problem ?? 'Mẹ bấm Nói lại để nói nhé');

  const restart = () => {
    edited.current = false;
    heard.current = '';
    setCountdown(null);
    setProblem(null);
    setTranscript('');
    setAttempt((n) => n + 1);
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <SonAvatar size={listening ? 140 : 104} mood={listening ? 'listening' : 'idle'} />
        <Txt size={FontSize.parentLarge} weight="bold" color={Colors.primary} center>
          {status}
        </Txt>
        {listening && (
          <Txt size={FontSize.parentBody} color={Colors.textMuted} center>
            Mẹ cứ nói. Nói xong con tự xem, không cần bấm gì.
          </Txt>
        )}
      </View>

      <TextInput
        value={transcript}
        onChangeText={(value) => {
          heard.current = value;
          setTranscript(value);
        }}
        onFocus={() => {
          stopAutoSend();
          ExpoSpeechRecognitionModule.stop();
        }}
        multiline
        maxFontSizeMultiplier={1.15}
        placeholder="Lời mẹ nói sẽ hiện ở đây…"
        placeholderTextColor={Colors.textMuted}
        style={[riso(Colors.teal), styles.transcript]}
      />

      <View style={styles.buttons}>
        {/* Chưa có chữ thì không hiện nút Gửi: ít nút hơn, mẹ đỡ phải chọn. */}
        {text ? (
          <BigButton
            label={countdown !== null ? 'Gửi ngay' : 'Gửi'}
            icon="paperplane.fill"
            height={100}
            fontSize={32}
            onPress={() => {
              setCountdown(null);
              ExpoSpeechRecognitionModule.abort();
              onSend(text);
            }}
          />
        ) : (
          !listening && <BigButton label="Nói lại" icon="mic.fill" tone="coral" height={100} fontSize={32} onPress={restart} />
        )}
        <View style={styles.row}>
          {!!text && <BigButton label="Nói lại" icon="mic.fill" tone="coral" height={80} disabled={listening} style={styles.half} onPress={restart} />}
          <BigButton label="Quay lại" tone="paper" height={80} style={styles.half} onPress={onCancel} />
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
    minHeight: 96,
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
