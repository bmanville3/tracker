import { Screen } from '@/src/components';
import { typography } from '@/src/theme';
import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <Screen>
        <Text style={typography.title}>
          Oops! Not Found.
        </Text>
        <View style={{ alignItems: 'center' }}>
          <Link href="/" style={{...typography.title, textDecorationLine: 'underline'}}>
            Go back to login screen
          </Link>
        </View>
      </Screen>
    </>
  );
}
