import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Role } from '@/types/hoicon';

const ROLE_KEY = 'hoicon.role';
export const LAST_REPLY_KEY = 'hoicon.replyCursor';

export async function getRole(): Promise<Role | null> {
  const value = await AsyncStorage.getItem(ROLE_KEY);
  return value === 'parent' || value === 'child' ? value : null;
}

export function setRole(role: Role): Promise<void> {
  return AsyncStorage.setItem(ROLE_KEY, role);
}

export function clearRole(): Promise<void> {
  return AsyncStorage.multiRemove([ROLE_KEY, LAST_REPLY_KEY, 'hoicon.lastReply']);
}
