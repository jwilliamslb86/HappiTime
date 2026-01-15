// src/screens/FavoritesScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { useHappyHours, type HappyHourWindow } from "../hooks/useHappyHours";
import { useUserLocation } from "../hooks/useUserLocation";
import { HappyHourCard } from "../components/HappyHourCard";
import { distanceMiles } from "../utils/location";

export const FavoritesScreen: React.FC = () => {
  const [tab, setTab] = useState<"favorites" | "activity" | "history">(
    "favorites"
  );
  const { data } = useHappyHours();
  const { coords } = useUserLocation();

  // TODO: once you store favorites per user, filter here.
  const favoriteWindows = data;
  // TODO: replace with real history data from Supabase when available.
  const historyWindows: typeof favoriteWindows = [];
  const favoritesWithDistance = useMemo(() => {
    return favoriteWindows.map((window) => {
      if (typeof window.distance === "number") return window;
      const lat = window.venue?.lat ?? null;
      const lng = window.venue?.lng ?? null;
      if (!coords || lat == null || lng == null) {
        return { ...window, distance: null };
      }
      return {
        ...window,
        distance: distanceMiles(coords.lat, coords.lng, lat, lng)
      };
    });
  }, [favoriteWindows, coords]);
  const nearbyPlaces = useMemo(() => {
    const withDistance = favoritesWithDistance.filter(
      (place) => typeof place.distance === "number"
    );
    return withDistance
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      .slice(0, 4);
  }, [favoritesWithDistance]);

  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>HappiTime</Text>

      <SegmentedTabs
        tabs={[
          { key: "favorites", label: "Favorites" },
          { key: "activity", label: "Activity" },
          { key: "history", label: "History" }
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as any)}
      />

      {tab === "favorites" && (
        <FlatList
          data={favoritesWithDistance}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            nearbyPlaces.length > 0 ? (
              <NearbyList items={nearbyPlaces} />
            ) : null
          }
          renderItem={({ item }) => (
            <HappyHourCard window={item} onPress={() => {}} />
          )}
        />
      )}

      {tab === "activity" && (
        <EmptyState
          title="Activity is on the way"
          message="Your recent happy hour visits and saves will show up here."
        />
      )}

      {tab === "history" && (
        historyWindows.length > 0 ? (
          <FlatList
            data={historyWindows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <HappyHourCard window={item} onPress={() => {}} />
            )}
          />
        ) : (
          <EmptyState
            title="No history yet"
            message="Past spots you've checked out will appear here."
          />
        )
      )}
    </View>
  );
};

const formatPriceTier = (tier?: number | null) =>
  typeof tier === "number" && tier > 0 ? "$".repeat(tier) : null;

const getPriceTier = (window: HappyHourWindow) => {
  const tier = window.venue?.price_tier;
  return typeof tier === "number" && tier > 0 ? tier : null;
};

type EmptyStateProps = {
  title: string;
  message: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderTitle}>{title}</Text>
    <Text style={styles.placeholderText}>{message}</Text>
  </View>
);

type NearbyListProps = {
  items: HappyHourWindow[];
};

const NearbyList: React.FC<NearbyListProps> = ({ items }) => (
  <View style={styles.nearbySection}>
    <Text style={styles.nearbyTitle}>Nearby venues</Text>
    {items.map((item, index) => {
      const distance =
        typeof item.distance === "number"
          ? item.distance < 0.1
            ? "<0.1 mi"
            : `${item.distance.toFixed(1)} mi`
          : "Distance unavailable";
      const venueName = item.venue?.name ?? item.venue_name ?? "Venue";
      const priceTier =
        formatPriceTier(getPriceTier(item)) ?? "$$";

      return (
        <View key={item.id} style={styles.nearbyRow}>
          <View
            style={[
              styles.nearbyDot,
              index === 0 ? styles.nearbyDotActive : styles.nearbyDotInactive
            ]}
          />
          <Text style={styles.nearbyText}>
            {venueName} | {distance} | {priceTier}
          </Text>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg
  },
  logoText: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.accent ?? colors.primary,
    marginBottom: spacing.md,
    alignSelf: "center"
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xs
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center"
  },
  nearbySection: {
    marginTop: spacing.md,
    paddingBottom: spacing.xl
  },
  nearbyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.sm
  },
  nearbyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm
  },
  nearbyDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: spacing.md
  },
  nearbyDotActive: {
    backgroundColor: colors.text
  },
  nearbyDotInactive: {
    backgroundColor: colors.border
  },
  nearbyText: {
    color: colors.textMuted,
    fontSize: 13
  }
});
