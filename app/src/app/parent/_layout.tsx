import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChildReplyOverlay } from '@/components/child-reply-overlay';
import { Colors } from '@/constants/theme';
import { prepareAudio } from '@/lib/speak';

export default function ParentLayout() {
  useEffect(() => {
    prepareAudio();
  }, []);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }} />
      <ChildReplyOverlay />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.bg } });
