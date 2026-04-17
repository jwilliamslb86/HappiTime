import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

export const LoadingSpinner: React.FC = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center"
  }
});
