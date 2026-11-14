import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getRole, setRole } from '@/lib/role';
import type { Role } from '@/types/hoicon';

/** Lần đầu mở: chọn vai. Đã chọn rồi thì vào thẳng vai đó (đóng hẳn app mở lại vẫn nhớ). */
export default function RolePicker() {
  const [role, setRoleState] = useState<Role | null | 'loading'>('loading');

  useEffect(() => {
    getRole()
      .then(setRoleState)
      .catch(() => setRoleState(null));
  }, []);

  if (role === 'loading') return <View style={styles.screen} />;
  if (role === 'parent') return <Redirect href="/parent" />;
  if (role === 'child') return <Redirect href="/child" />;

  const choose = (next: Role) => {
    setRole(next).catch(() => undefined);
    setRoleState(next);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <SonAvatar size={170} />
        <Txt size={44} weight="bold">
          Hỏi Con
        </Txt>
        <Txt size={FontSize.parentBody} color={Colors.textMuted} center>
          Khi bố mẹ không chắc, con luôn ở đó.
        </Txt>
      </View>
      <View style={styles.buttons}>
        <BigButton label="Tôi là bố mẹ" icon="figure.2" height={110} fontSize={FontSize.parentLarge} onPress={() => choose('parent')} />
        <BigButton label="Tôi là con" icon="person.fill" tone="paper" height={110} fontSize={FontSize.parentLarge} onPress={() => choose('child')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.four },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  buttons: { gap: Spacing.four, paddingBottom: Spacing.four },
});
