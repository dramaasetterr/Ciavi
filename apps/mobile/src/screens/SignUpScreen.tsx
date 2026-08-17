import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../App";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { colors, shadows, borderRadius, typography, spacing } from "../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const clearErrors = () => {
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setGeneralError("");
  };

  const handleSignUp = async () => {
    clearErrors();

    let hasError = false;

    if (!fullName.trim()) {
      setNameError("Please enter your full name.");
      hasError = true;
    }
    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      hasError = true;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      hasError = true;
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    // Use supabase directly so we can get the user data for profile upsert
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: "https://gochiavi.com/verified" },
    });

    if (error) {
      setLoading(false);
      setGeneralError("Could not create your account. Please try again.");
      return;
    }

    // Supabase returns a user with empty identities when email already exists
    // (instead of an error, for security). Detect this and show a helpful message.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setLoading(false);
      setEmailError("An account with this email already exists. Try logging in instead.");
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: email.trim(),
        full_name: fullName.trim(),
        current_stage: "prep_your_home",
      });
    }

    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successIcon}>{"\u2709\uFE0F"}</Text>
          </View>
          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successMessage}>
            We sent a verification link to{"\n"}
            <Text style={styles.successEmail}>{email.trim()}</Text>
          </Text>
          <Text style={styles.successHint}>
            Click the link in your email to activate your account, then come
            back and log in.
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.85}
          >
            <Text style={styles.successButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Create Your{"\n"}Account</Text>
            <Text style={styles.subheading}>
              Start selling your home the smart way
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {generalError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{generalError}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[
                  styles.input,
                  nameFocused && styles.inputFocused,
                  nameError ? styles.inputError : null,
                ]}
                placeholder="John Smith"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (nameError) setNameError("");
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              {nameError ? (
                <Text style={styles.fieldError}>{nameError}</Text>
              ) : null}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                ref={emailRef}
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                  emailError ? styles.inputError : null,
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError("");
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {emailError ? (
                <Text style={styles.fieldError}>{emailError}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused,
                    passwordError ? styles.inputError : null,
                  ]}
                  placeholder="Create a password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError("");
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword ? "\uD83D\uDC41" : "\uD83D\uDC41\u200D\uD83D\uDDE8"}
                  </Text>
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text style={styles.fieldError}>{passwordError}</Text>
              ) : (
                <Text style={styles.fieldHint}>Minimum 6 characters</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={confirmRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    confirmFocused && styles.inputFocused,
                    confirmError ? styles.inputError : null,
                  ]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (confirmError) setConfirmError("");
                  }}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.eyeIcon}>
                    {showConfirmPassword ? "\uD83D\uDC41" : "\uD83D\uDC41\u200D\uD83D\uDDE8"}
                  </Text>
                </TouchableOpacity>
              </View>
              {confirmError ? (
                <Text style={styles.fieldError}>{confirmError}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.6}
            >
              <Text style={styles.switchAuthText}>
                Already have an account?{" "}
                <Text style={styles.switchAuthLink}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 36,
  },
  heading: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 8,
  },

  // Form
  form: {
    gap: 20,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 7,
  },
  label: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  inputFocused: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 32,
  },
  eyeIcon: {
    fontSize: 18,
  },
  fieldError: {
    ...typography.small,
    color: colors.error,
    marginTop: 2,
  },
  fieldHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.errorDark,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 17,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginTop: 4,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingTop: 8,
  },
  switchAuthText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  switchAuthLink: {
    color: colors.primaryLight,
    fontWeight: "700",
  },

  // Success state
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 36,
  },
  successTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  successMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  successEmail: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  successHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  successButton: {
    backgroundColor: colors.primary,
    paddingVertical: 17,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    width: "100%",
    marginTop: 32,
    ...shadows.md,
  },
  successButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
  },
});
