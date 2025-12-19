import { User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { supabase } from './supabase';

export async function getUser(): Promise<User | null> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    showAlert("Auth error", authErr.message);
    return null;
  }
  const user = auth.user;
  if (!user) {
    showAlert("No user found", "You appear to be logged out. Try logging out and back in");
    return null;
  }
  return user;
}

export const showAlert = (
  title: string,
  message?: string,
) => {
  if (typeof window !== 'undefined') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};
