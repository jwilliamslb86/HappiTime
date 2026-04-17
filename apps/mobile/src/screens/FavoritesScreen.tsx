// src/screens/FavoritesScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { HappyHourCard } from "../components/HappyHourCard";
import { useHappyHours, type HappyHourWindow } from "../hooks/useHappyHours";
import { useUserFollowedVenues } from "../hooks/useUserFollowedVenues";
import { useUserHistory, type HistoryEntry } from "../hooks/useUserHistory";
import { useUserLists, type UserList } from "../hooks/useUserLists";
import { useUserLocation } from "../hooks/useUserLocation";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { distanceMiles } from "../utils/location";

export const FavoritesScreen: React.FC = () => {
  const [tab, setTab] = useState<"favorites" | "history" | "lists">(
    "favorites"
  );
  const { data } = useHappyHours();
  const { coords } = useUserLocation();
  const { venueIds: followedVenueIds, loading: followedLoading } =
    useUserFollowedVenues();
  const { entries: historyEntries, loading: historyLoading } = useUserHistory();
  const { lists, loading: listsLoading } = useUserLists();

  const favoriteWindows = data;
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
  const followedVenueSet = useMemo(
    () => new Set(followedVenueIds),
    [followedVenueIds]
  );

  const favoriteOnly = useMemo(() => {
    if (followedVenueSet.size === 0) return [];
    return favoritesWithDistance.filter(
      (window) =>
        typeof window.venue_id === "string" &&
        followedVenueSet.has(window.venue_id)
    );
  }, [favoritesWithDistance, followedVenueSet]);

  const nearbyPlaces = useMemo(() => {
    const withDistance = favoriteOnly.filter(
      (place) => typeof place.distance === "number"
    );
    return withDistance
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      .slice(0, 4);
  }, [favoriteOnly]);

  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>HappiTime</Text>

      <SegmentedTabs
        tabs={[
          { key: "favorites", label: "Favorites" },
          { key: "history", label: "History" },
          { key: "lists", label: "Lists" }
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as any)}
      />

      {tab === "favorites" && (
        <FlatList
          data={favoriteOnly}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            followedLoading ? (
              <LoadingSpinner />
            ) : (
              <EmptyState
                title="No saved venues yet"
                message="Save a venue from a happy hour detail screen."
              />
            )
          }
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

      {tab === "history" && (
        historyLoading ? (
          <LoadingSpinner />
        ) : historyEntries.length > 0 ? (
          <FlatList
            data={historyEntries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => <HistoryRow entry={item} />}
          />
        ) : (
          <EmptyState
            title="No history yet"
            message="Past spots you've checked out will appear here."
          />
        )
      )}

      {tab === "lists" && (
        listsLoading ? (
          <LoadingSpinner />
        ) : lists.length > 0 ? (
          <FlatList
            data={lists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => <ListRow list={item} />}
          />
        ) : (
          <EmptyState
            title="No lists yet"
            message="Tap the + tab to create your first list."
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

const EVENT_LABEL: Record<string, string> = {
  venue_view: "Viewed",
  venue_save: "Saved",
  venue_checkin: "Checked in",
};

const formatHistoryDate = (iso: string) => {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffMs = Date.now() - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

type HistoryRowProps = { entry: HistoryEntry };

const HistoryRow: React.FC<HistoryRowProps> = ({ entry }) => {
  const venueName = entry.venue?.name ?? "Unknown venue";
  const locationParts = [entry.venue?.city, entry.venue?.state].filter(Boolean);
  const location = locationParts.join(", ");
  const label = EVENT_LABEL[entry.event_type] ?? entry.event_type;

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyInitial}>
        <Text style={styles.historyInitialText}>
          {venueName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.historyText}>
        <Text style={styles.historyVenue}>{venueName}</Text>
        {location ? (
          <Text style={styles.historyMeta}>{location}</Text>
        ) : null}
      </View>
      <View style={styles.historyTrailing}>
        <Text style={styles.historyLabel}>{label}</Text>
        <Text style={styles.historyWhen}>{formatHistoryDate(entry.created_at)}</Text>
      </View>
    </View>
  );
};

type ListRowProps = { list: UserList };

const ListRow: React.FC<ListRowProps> = ({ list }) => (
  <View style={styles.historyRow}>
    <View style={[styles.historyInitial, styles.listIcon]}>
      <Text style={styles.historyInitialText}>
        {list.name.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.historyText}>
      <Text style={styles.historyVenue}>{list.name}</Text>
      {list.description ? (
        <Text style={styles.historyMeta}>{list.description}</Text>
      ) : null}
    </View>
    <View style={styles.historyTrailing}>
      <Text style={styles.historyLabel}>
        {list.item_count} {list.item_count === 1 ? "venue" : "venues"}
      </Text>
      <Text style={styles.historyWhen}>
        {list.visibility === "public" ? "Public" : "Private"}
      </Text>
    </View>
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
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
    marginLeft: 56
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md
  },
  historyInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md
  },
  historyInitialText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15
  },
  historyText: {
    flex: 1
  },
  historyVenue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  historyTrailing: {
    alignItems: "flex-end",
    marginLeft: spacing.sm
  },
  historyLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500"
  },
  historyWhen: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2
  },
  listIcon: {
    backgroundColor: colors.pillActiveBg ?? colors.surface,
    borderColor: "transparent",
  }
});
