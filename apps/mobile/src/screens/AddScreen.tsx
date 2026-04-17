import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../api/supabaseClient";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useUserLists } from "../hooks/useUserLists";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Mode = "home" | "venue" | "list";

export const AddScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>("home");

  if (mode === "venue") {
    return <VenueSuggestionForm onBack={() => setMode("home")} />;
  }

  if (mode === "list") {
    return <NewListForm onBack={() => setMode("home")} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.subtitle}>
        Start a new list or save a venue you love.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
        onPress={() => setMode("venue")}
      >
        <Text style={styles.optionTitle}>Suggest a Venue</Text>
        <Text style={styles.optionText}>
          Know a great happy hour spot? Let us know and we'll look into adding it.
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.optionCard, pressed && styles.optionCardPressed]}
        onPress={() => setMode("list")}
      >
        <Text style={styles.optionTitle}>New List</Text>
        <Text style={styles.optionText}>
          Collect your favorite happy hours in one place.
        </Text>
      </Pressable>
    </View>
  );
};

type NewListFormProps = {
  onBack: () => void;
};

const NewListForm: React.FC<NewListFormProps> = ({ onBack }) => {
  const { createList } = useUserLists();
  const [listName, setListName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = listName.trim().length > 0;

  const handleCreate = async () => {
    if (!isValid) return;
    setSaving(true);
    const { error } = await createList(listName, description);
    setSaving(false);

    if (error) {
      Alert.alert("Something went wrong", error.message);
      return;
    }

    Alert.alert("List created!", `"${listName.trim()}" is ready. Find it in your Favorites.`, [
      { text: "Done", onPress: onBack },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>New List</Text>
        <Text style={styles.subtitle}>
          Give your list a name to get started.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>List name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sunday Brunch Crawl"
            placeholderTextColor={colors.textMuted}
            value={listName}
            onChangeText={setListName}
            returnKeyType="next"
            autoFocus
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="What's this list about?"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            returnKeyType="done"
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !isValid && styles.submitButtonDisabled,
              pressed && isValid && styles.submitButtonPressed,
            ]}
            onPress={handleCreate}
            disabled={!isValid || saving}
          >
            <Text style={styles.submitButtonText}>
              {saving ? "Creating…" : "Create list"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

type VenueSuggestionFormProps = {
  onBack: () => void;
};

const VenueSuggestionForm: React.FC<VenueSuggestionFormProps> = ({ onBack }) => {
  const { user } = useCurrentUser();
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = venueName.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || !user?.id) return;

    setSaving(true);
    const { error } = await supabase.from("user_events").insert({
      user_id: user.id,
      event_type: "venue_suggestion",
      venue_id: null,
      meta: {
        venue_name: venueName.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        notes: notes.trim() || null,
      },
    });
    setSaving(false);

    if (error) {
      Alert.alert("Something went wrong", error.message);
      return;
    }

    Alert.alert(
      "Thanks!",
      "We've received your suggestion and will look into adding this venue.",
      [{ text: "Done", onPress: onBack }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Suggest a Venue</Text>
        <Text style={styles.subtitle}>
          Fill in what you know — even just the name helps.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Venue name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. The Peanut"
            placeholderTextColor={colors.textMuted}
            value={venueName}
            onChangeText={setVenueName}
            returnKeyType="next"
          />

          <Text style={styles.label}>Street address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 5012 Main St"
            placeholderTextColor={colors.textMuted}
            value={address}
            onChangeText={setAddress}
            returnKeyType="next"
          />

          <Text style={styles.label}>City & State</Text>
          <View style={styles.cityRow}>
            <TextInput
              style={[styles.input, styles.cityInput]}
              placeholder="City"
              placeholderTextColor={colors.textMuted}
              value={city}
              onChangeText={setCity}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, styles.stateInput]}
              placeholder="ST"
              placeholderTextColor={colors.textMuted}
              value={state}
              onChangeText={setState}
              autoCapitalize="characters"
              maxLength={2}
              returnKeyType="next"
            />
          </View>

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Anything else we should know — hours, specials, website…"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            returnKeyType="done"
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !isValid && styles.submitButtonDisabled,
              pressed && isValid && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!isValid || saving}
          >
            <Text style={styles.submitButtonText}>
              {saving ? "Submitting…" : "Submit suggestion"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  optionCard: {
    backgroundColor: colors.surface ?? colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  optionCardPressed: {
    opacity: 0.85,
  },
  optionCardDisabled: {
    opacity: 0.5,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  comingSoon: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  formCard: {
    backgroundColor: colors.surface ?? colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
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
    marginBottom: spacing.md,
  },
  cityRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cityInput: {
    flex: 1,
  },
  stateInput: {
    width: 52,
    textAlign: "center",
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    marginTop: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.pillActiveBg,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonText: {
    color: colors.pillActiveText,
    fontSize: 14,
    fontWeight: "600",
  },
});
