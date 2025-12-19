import { supabase } from '@/src/supabase';
import { showAlert } from '@/src/utils';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Profile() {
  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showAlert('Error', error.message);
      return;
    }
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile</Text>
      <TouchableOpacity style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#25292e', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontSize: 18, marginBottom: 16 },
  button: { paddingVertical: 12, paddingHorizontal: 18, backgroundColor: '#3a7afe', borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
