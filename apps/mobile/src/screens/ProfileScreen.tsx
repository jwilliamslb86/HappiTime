// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { supabase } from "../api/supabaseClient";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useUserFollowCounts } from "../hooks/useUserFollowCounts";
import { useUserFollowedVenues } from "../hooks/useUserFollowedVenues";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { useUserProfile } from "../hooks/useUserProfile";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export const ProfileScreen: React.FC = () => {
  const { user, loading: userLoading } = useCurrentUser();
  const {
    profile,
    loading: profileLoading,
    saving,
    saveProfile
  } = useUserProfile();
  const { followerCount, followingCount, loading: countsLoading } =
    useUserFollowCounts();
  const { venueIds, loading: venuesLoading } = useUserFollowedVenues();
  const {
    preferences,
    saving: prefSaving,
    savePreferences,
  } = useUserPreferences();

  const [displayName, setDisplayName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeState, setHomeState] = useState("");
  const [notifPush, setNotifPush] = useState(true);
  const [notifProduct, setNotifProduct] = useState(true);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => supabase.auth.signOut()
      }
    ]);
  };

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setHandle(profile.handle ?? "");
    setBio(profile.bio ?? "");
    setIsPublic(profile.is_public);
  }, [profile]);

  useEffect(() => {
    setHomeCity(preferences.home_city ?? "");
    setHomeState(preferences.home_state ?? "");
    setNotifPush(preferences.notifications_push);
    setNotifProduct(preferences.notifications_product);
  }, [preferences]);

  const handleSave = async () => {
    setStatusMessage(null);
    const { error } = await saveProfile({
      display_name: displayName,
      handle,
      bio,
      is_public: isPublic
    });
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    setStatusMessage("Profile saved.");
  };

  if (userLoading || profileLoading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Account</Text>
      <Text style={styles.subtitle}>
        Sign in, manage preferences, and see your saved happy hours here.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? "Unknown"}</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>Handle</Text>
        <TextInput
          style={styles.input}
          placeholder="@handle"
          placeholderTextColor={colors.textMuted}
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="Tell people about your happy hour style."
          placeholderTextColor={colors.textMuted}
          value={bio}
          onChangeText={setBio}
          multiline
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Public profile</Text>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            saving && styles.primaryButtonDisabled
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? "Saving..." : "Save profile"}
          </Text>
        </Pressable>

        {statusMessage ? (
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <Text style={styles.label}>Home city</Text>
        <View style={styles.cityRow}>
          <TextInput
            style={[styles.input, styles.cityInput]}
            placeholder="City"
            placeholderTextColor={colors.textMuted}
            value={homeCity}
            onChangeText={setHomeCity}
          />
          <TextInput
            style={[styles.input, styles.stateInput]}
            placeholder="ST"
            placeholderTextColor={colors.textMuted}
            value={homeState}
            onChangeText={setHomeState}
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Push notifications</Text>
          <Switch
            value={notifPush}
            onValueChange={setNotifPush}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Product updates</Text>
          <Switch
            value={notifProduct}
            onValueChange={setNotifProduct}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            prefSaving && styles.primaryButtonDisabled,
          ]}
          onPress={() =>
            savePreferences({
              home_city: homeCity.trim() || null,
              home_state: homeState.trim() || null,
              notifications_push: notifPush,
              notifications_product: notifProduct,
            })
          }
          disabled={prefSaving}
        >
          <Text style={styles.primaryButtonText}>
            {prefSaving ? "Saving..." : "Save preferences"}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutButtonText}>Sign out</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>
              {countsLoading ? "—" : followerCount}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>
              {countsLoading ? "—" : followingCount}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>
              {venuesLoading ? "—" : venueIds.length}
            </Text>
            <Text style={styles.statLabel}>Saved venues</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14
  },
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface ?? colors.background
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.md
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs
  },
  value: {
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.md
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground ?? colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: colors.pillActiveBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm
  },
  primaryButtonPressed: {
    opacity: 0.9
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: colors.pillActiveText,
    fontSize: 14,
    fontWeight: "600"
  },
  statusMessage: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12
  },
  cityRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cityInput: {
    flex: 1,
    marginBottom: 0,
  },
  stateInput: {
    width: 52,
    marginBottom: 0,
    textAlign: "center",
  },
  signOutButton: {
    marginTop: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: "center",
    paddingVertical: spacing.sm
  },
  signOutButtonPressed: {
    opacity: 0.7
  },
  signOutButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600"
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  statBlock: {
    alignItems: "center",
    flex: 1
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs
  }
});
