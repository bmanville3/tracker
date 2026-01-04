import { Button, Screen, TextField } from "@/src/components";
import { ErrorBanner } from "@/src/components/ErrorBanner";
import { supabase } from "@/src/supabase";
import { CACHE_FACTORY } from "@/src/swrCache";
import { colors, typography } from "@/src/theme";
import { showAlert } from "@/src/utils";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity } from "react-native";

export default function Index() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  const [isSigningUp, setIsSigningUp] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      setErrorMessage(null);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/(tabs)/home");
      }
    })();
  }, []);

  const navigateToApp = () => {
    setErrorMessage(null);
    CACHE_FACTORY.clearAll();
    router.replace("/(tabs)/home");
  };

  const onLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showAlert("Missing info", "Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(`Login failed: ${error.message}`);
        return;
      }

      if (data.session) {
        navigateToApp();
      } else {
        setErrorMessage("Login failed. No sessions returned.")
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSignUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      showAlert("Missing info", "Please enter your email and password.");
      return;
    }


    if (password !== confirmPassword) {
      showAlert(
        "Password does not match",
        "Please make sure the password matches",
      );
      return;
    }

    setIsLoading(true);
    try {
      const emailRedirectTo = Linking.createURL("/");
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo, 
          data: {
            display_name: displayName,
            default_weight_unit: "lb",
            default_distance_unit: "mi",
          },
        },
      });

      if (error) {
        if (error.message?.toLowerCase().includes("already registered")) {
          setErrorMessage("You already have an account. Try logging in instead.");
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      if (!data.user) {
        setErrorMessage("Something went wrong signing you up. Please try again.");
        return;
      }

      if (data.session) {
        navigateToApp();
        return;
      } else {
        const identities = data.user.identities ?? [];
        if (identities.length > 0) {
          showAlert("We sent you a confirmation email. Please check your inbox.");
        } else {
          showAlert(
            "You already started signing up before. We've resent your confirmation email—check your inbox.",
            "If this account is already registered and confirmed, please sign in."
          );
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo,
            },
          });

          if (resendError) {
            console.error(resendError);
            setErrorMessage(`Error with resend: ${resendError.message}`);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      showAlert(
        "Missing email",
        "Enter your email first, then tap “Forgot password?”.",
      );
      return;
    }

    const redirectTo = Linking.createURL("reset-password");

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo,
        },
      );

      if (error) {
        setErrorMessage(`Reset failed: ${error.message}`);
        return;
      }

      showAlert("Check your email", "We sent you a password reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>{isSigningUp ? "Sign up" : "Log in"}</Text>

      {isSigningUp && (
        <>
          <Text style={typography.label}>Display Name</Text>
          <TextField
            autoCapitalize="none"
            autoCorrect={false}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="John Doe"
          />
        </>
      )}

      <Text style={typography.label}>Email</Text>
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={(text) => setEmail(text.trim())}
        placeholder="you@example.com"
      />

      <Text style={typography.label}>Password</Text>
      <TextField
        secureTextEntry
        value={password}
        onChangeText={(text) => setPassword(text.trim())}
        placeholder="••••••••"
      />
      {!isSigningUp && (
        <TouchableOpacity
          style={{ marginTop: 10, alignSelf: "flex-end" }}
          onPress={onForgotPassword}
          disabled={isLoading}
        >
          <Text style={{ color: colors.placeholderTextColor, fontWeight: "600", marginBottom: 4 }}>
            Forgot password?
          </Text>
        </TouchableOpacity>
      )}

      {isSigningUp && (
        <>
          <Text style={typography.label}>Confirm Password</Text>
          <TextField
           style={{ marginBottom: 10 }}
            secureTextEntry
            value={confirmPassword}
            onChangeText={(text) => setConfirmPassword(text.trim())}
            placeholder="••••••••"
          />
        </>
      )}

      {errorMessage && <ErrorBanner errorText={errorMessage}/>}

      <Button
        title={
          isLoading
            ? "Please wait..."
            : isSigningUp
              ? "Create account"
              : "Log in"
        }
        onPress={() => {
          setErrorMessage(null);
          isSigningUp ? onSignUp() : onLogin();
        }}
        disabled={isLoading
          || password.length === 0
          || email.length === 0
          || isSigningUp && (password !== confirmPassword
          || displayName.length === 0)
        }
        variant="primary"
      />

      <Button
        title={
          isLoading
            ? "Please wait..."
            : isSigningUp
              ? "Go back to login"
              : "Sign up"
        }
        onPress={() => {
          setErrorMessage(null);
          setIsSigningUp(!isSigningUp);
        }}
        disabled={isLoading}
        variant="secondary"
      />
    </Screen>
  );
}
