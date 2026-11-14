import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ParentHome } from '@/components/parent/home';
import { ListenView } from '@/components/parent/listen';
import { ProcessingView } from '@/components/parent/processing';
import { ResultView } from '@/components/parent/result';
import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { CHILD_NAME, CHILD_PHONE, FAMILY_ID } from '@/constants/family';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { ask } from '@/lib/api';
import { pickPhoto } from '@/lib/photo';
import { clearRole } from '@/lib/role';
import { call, say, stopSpeaking } from '@/lib/speak';
import type { AskEvent } from '@/types/hoicon';

type Question = { imageUri?: string; text?: string };

type Stage =
  | { name: 'home' }
  | { name: 'listen' }
  | { name: 'processing'; question: Question }
  | { name: 'result'; event: AskEvent }
  | { name: 'error'; message: string; question?: Question };

export default function ParentScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: 'home' });
  // Giữ thread_id khi bấm "Hỏi thêm" để agent nhớ câu trước.
  const [threadId, setThreadId] = useState<string | null>(null);

  const submit = (question: Question, thread: string | null) => {
    setStage({ name: 'processing', question });
    say('Đang xem giúp mẹ, mẹ chờ con một chút nhé.');
    ask({ ...question, familyId: FAMILY_ID, threadId: thread })
      .then((event) => {
        setThreadId(event.thread_id);
        setStage({ name: 'result', event });
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'Có trục trặc, mẹ thử lại nhé.';
        say('Con chưa xem được. Mẹ bấm thử lại nhé.');
        setStage({ name: 'error', message, question });
      });
  };

  const capture = (source: 'camera' | 'library') => {
    pickPhoto(source)
      .then((uri) => {
        if (uri) submit({ imageUri: uri }, null);
      })
      .catch((e: unknown) => {
        setStage({ name: 'error', message: e instanceof Error ? e.message : 'Chưa mở được máy ảnh.' });
      });
  };

  const goHome = () => {
    stopSpeaking();
    setThreadId(null);
    setStage({ name: 'home' });
  };

  const resetRole = () => {
    stopSpeaking();
    clearRole()
      .catch(() => undefined)
      .then(() => router.replace('/'));
  };

  return (
    <SafeAreaView style={styles.screen}>
      {stage.name === 'home' && (
        <ParentHome
          onCamera={() => capture('camera')}
          onLibrary={() => capture('library')}
          onSpeak={() => {
            setThreadId(null);
            setStage({ name: 'listen' });
          }}
          onCall={() => call(CHILD_PHONE)}
          onResetRole={resetRole}
        />
      )}
      {stage.name === 'listen' && <ListenView onSend={(text) => submit({ text }, threadId)} onCancel={goHome} />}
      {stage.name === 'processing' && <ProcessingView {...stage.question} />}
      {stage.name === 'result' && (
        <ResultView
          event={stage.event}
          onDone={goHome}
          onAskMore={() => {
            stopSpeaking();
            setStage({ name: 'listen' });
          }}
          onCall={() => call(CHILD_PHONE)}
        />
      )}
      {stage.name === 'error' && (
        <View style={styles.error}>
          <SonAvatar size={140} />
          <Txt size={FontSize.heading} weight="bold" center>
            Con chưa xem được
          </Txt>
          <Txt size={FontSize.parentBody} color={Colors.textMuted} center>
            {stage.message}
          </Txt>
          <View style={styles.errorButtons}>
            {stage.question && (
              <BigButton label="Thử lại" icon="arrow.clockwise" height={110} fontSize={30} onPress={() => submit(stage.question!, threadId)} />
            )}
            <BigButton label={`Gọi con ${CHILD_NAME}`} icon="phone.fill" tone="paper" height={84} onPress={() => call(CHILD_PHONE)} />
            <BigButton label="Về màn hình chính" tone="paper" height={76} onPress={goHome} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  errorButtons: { alignSelf: 'stretch', gap: Spacing.three, marginTop: Spacing.three },
});
