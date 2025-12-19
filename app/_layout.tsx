import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth screen */}
      <Stack.Screen name="index" />

      {/* Main app (tabs) */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
