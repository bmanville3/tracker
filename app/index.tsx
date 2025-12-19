import { Button, Screen, TextField } from '@/src/components';
import { supabase } from '@/src/supabase';
import { typography } from '@/src/theme';
import { showAlert } from '@/src/utils';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';

export default function Index() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSigningUp, setIsSigningUp] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/(tabs)/home');
      }
    })();
  }, []);


  const onLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showAlert('Missing info', 'Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        showAlert('Login failed', error.message);
        return;
      }

      if (data.session) {
        router.replace('/(tabs)/home');
      } else {
        showAlert('Login failed', 'No session returned.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSignUp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showAlert('Missing info', 'Please enter your email and password.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Password does not match', 'Please make sure the password matches');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (error) {
        showAlert('Sign up failed', error.message);
        return;
      }

      // Depending on your Supabase email confirmation settings, the session may be null.
      if (data.session) {
        router.replace('/(tabs)/home');
      } else {
        showAlert(
          'Check your email',
          'If email confirmations are enabled, youll need to confirm your email before logging in.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert('Missing email', 'Enter your email first, then tap “Forgot password?”.');
      return;
    }

    const redirectTo = Linking.createURL('reset-password');

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      });

      if (error) {
        showAlert('Reset failed', error.message);
        return;
      }

      showAlert('Check your email', 'We sent you a password reset link.');
    } finally {
      setIsLoading(false);
    }
  };


  return !isSigningUp ? (
    <Screen>
      <Text style={typography.title}>Log in</Text>

      <Text style={typography.label}>Email</Text>
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      <Text style={typography.label}>Password</Text>
      <TextField
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />
      <TouchableOpacity
        style={{ marginTop: 10, alignSelf: 'flex-end' }}
        onPress={onForgotPassword}
        disabled={isLoading}
      >
        <Text style={{ color: '#9aa0a6', fontWeight: '600' }}>
          Forgot password?
        </Text>
      </TouchableOpacity>

      <Button
        title={isLoading ? 'Please wait...' : 'Log in'}
        onPress={onLogin}
        disabled={isLoading}
        variant='primary'
      />

      <Button
        title={isLoading ? 'Please wait...' : 'Sign up'}
        onPress={() => setIsSigningUp(true)}
        disabled={isLoading}
        variant='secondary'
      />
    </Screen>
  ) : (
    <Screen>
      <Text style={typography.title}>Sign up</Text>

      <Text style={typography.label}>Email</Text>
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      <Text style={typography.label}>Password</Text>
      <TextField
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />

      <Text style={typography.label}>Confirm Password</Text>
      <TextField
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
      />

      <Button
        title={isLoading ? 'Please wait...' : 'Create account'}
        onPress={onSignUp}
        disabled={isLoading}
        variant='primary'
      />

      <Button
        title={isLoading ? 'Please wait...' : 'Go Back'}
        onPress={() => setIsSigningUp(false)}
        disabled={isLoading}
        variant='secondary'
      />
    </Screen>
  );
}
