import { Stack } from 'expo-router';

export default function ProgramStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Programs' }} />
      <Stack.Screen name="[programId]/index" options={{ title: 'Workouts' }} />
      <Stack.Screen name="[programId]/workout/[workoutId]" options={{ title: 'Edit workout' }} />
    </Stack>
  );
}
