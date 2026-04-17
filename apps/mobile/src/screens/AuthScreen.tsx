// src/screens/AuthScreen.tsx
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { supabase } from "../api/supabaseClient";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const redirectTo = Linking.createURL("auth/callback");

const handleEmailContinue = async () => {
  const trimmed = email.trim();

  if (!trimmed) {
    setStatusMessage("Enter an email to continue.");
    return;
  }

  try {
    setLoading(true);
    setStatusMessage(null);

    console.log("🔐 Starting magic link sign-in…", trimmed);

    const { data, error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });

    console.log("📨 Supabase response:", { data, error });

    if (error) {
      console.error("❌ Supabase OTP error:", error);
      setStatusMessage(`Auth error: ${error.message}`);
      return;
    }

    if (!data) {
      console.warn("⚠ No data returned from OTP request");
    }

    setStatusMessage("Magic link sent. Check your email 👍");

  } catch (err: any) {
    console.error("🔥 Unexpected auth exception:", err);
    setStatusMessage(err?.message ?? "Unexpected error");
  } finally {
    setLoading(false);
  }
};

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      setLoading(true);
      setStatusMessage(null);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("[AuthScreen] oauth error", error);
        setStatusMessage(error.message);
        return;
      }

      // On mobile, Supabase opens the browser for OAuth.
      // We just show a small hint so it doesn't feel broken.
      if (data?.url) {
        setStatusMessage("Opening browser to continue sign in…");
      }
    } catch (err: any) {
      console.error("[AuthScreen] oauth unexpected error", err);
      setStatusMessage(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top safe area spacer is handled by paddingTop */}
      <Text style={styles.logoText}>HappiTime</Text>

      <View style={styles.content}>
        <Text style={styles.title}>Create an Account</Text>
        <Text style={styles.subtitle}>
          Enter your email to sign up for this app
        </Text>

        <TextInput
          style={styles.input}
          placeholder="email@domain.com"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            loading && styles.primaryButtonDisabled
          ]}
          onPress={handleEmailContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.pillActiveText} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google */}
        <Pressable
          style={({ pressed }) => [
            styles.oauthButton,
            pressed && styles.oauthButtonPressed
          ]}
          onPress={() => handleOAuth("google")}
        >
          <View style={styles.oauthIcon} />
          <Text style={styles.oauthButtonText}>Continue with Google</Text>
        </Pressable>

        {/* Apple */}
        <Pressable
          style={({ pressed }) => [
            styles.oauthButton,
            pressed && styles.oauthButtonPressed
          ]}
          onPress={() => handleOAuth("apple")}
        >
          <View style={styles.oauthIcon} />
          <Text style={styles.oauthButtonText}>Continue with Apple</Text>
        </Pressable>

        {statusMessage ? (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        ) : null}

        <Text style={styles.legalText}>
          By clicking continue, you agree to our{" "}
          <Text
            style={styles.linkText}
            onPress={() => Linking.openURL("https://happitime.app/terms")}
          >
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            style={styles.linkText}
            onPress={() => Linking.openURL("https://happitime.app/privacy")}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 80,
    paddingHorizontal: spacing.lg,
    alignItems: "stretch"
  },
  logoText: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xl,
    textAlign: "center",
    alignSelf: "center"
  },
  content: {
    width: "100%",
    alignItems: "center"
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg
  },
  input: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md
  },
  primaryButton: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.pillActiveBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.lg
  },
  primaryButtonPressed: {
    opacity: 0.9
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: colors.pillActiveText,
    fontSize: 16,
    fontWeight: "600"
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    width: "100%"
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border
  },
  dividerText: {
    marginHorizontal: spacing.sm,
    color: colors.textMuted,
    fontSize: 13
  },
  oauthButton: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm
  },
  oauthButtonPressed: {
    opacity: 0.9
  },
  oauthIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  oauthButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500"
  },
  statusMessage: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    width: "100%"
  },
  legalText: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    width: "100%"
  },
  linkText: {
    color: colors.primary,
    fontWeight: "500"
  }
});
