// src/screens/HomeScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  Image
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useHappyHours, type HappyHourWindow } from "../hooks/useHappyHours";
import { useUserLocation } from "../hooks/useUserLocation";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorState } from "../components/ErrorState";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { distanceMiles } from "../utils/location";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

type CuisineMode = "tags" | "offers";

const formatTagLabel = (tag: string) =>
  tag
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatCuisineLabel = (value: string, mode: CuisineMode) => {
  if (value === "all") return "All";
  if (mode === "offers") {
    if (value === "food") return "Food";
    if (value === "drinks") return "Drinks";
    if (value === "both") return "Both";
  }
  return formatTagLabel(value);
};

const normalizeCuisine = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

const getPlaceCuisines = (window: HappyHourWindow) =>
  (window.venue?.tags ?? []).map(normalizeCuisine).filter(Boolean);

const getVenueName = (window: HappyHourWindow) =>
  window.venue?.name ?? window.venue_name ?? "Venue";

const formatPriceTier = (tier?: number | null) =>
  typeof tier === "number" && tier > 0 ? "$".repeat(tier) : null;

const getPriceTier = (window: HappyHourWindow) => {
  const tier = window.venue?.price_tier;
  return typeof tier === "number" && tier > 0 ? tier : null;
};

const formatMapAddress = (window: HappyHourWindow) => {
  const venue = window.venue;
  if (!venue) return "";
  const zip = venue.zip == null ? null : String(venue.zip);
  const parts = [venue.address, venue.city, venue.state, zip].filter(Boolean);
  return parts.join(", ");
};

export const HomeScreen: React.FC<Props> = () => {
  const { data, loading, error, refreshing, refresh } = useHappyHours();
  const { coords, error: locationError } = useUserLocation();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("all");
  const [selectedPrice, setSelectedPrice] = useState<number | "all">("all");    

  const todayIndex = new Date().getDay();

  const getDowValues = (window: HappyHourWindow) => {
    if (!Array.isArray(window.dow)) return [];
    return window.dow
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  };

  const todaysPlaces = useMemo(() => {
    return data.filter((window) => getDowValues(window).includes(todayIndex));
  }, [data, todayIndex]);

  const withDistance = useMemo(() => {
    return todaysPlaces
      .map((window) => {
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
      })
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
  }, [todaysPlaces, coords]);

  const cuisineMeta = useMemo(() => {
    const cuisineSet = new Set<string>();

    for (const place of todaysPlaces) {
      for (const cuisine of getPlaceCuisines(place)) {
        cuisineSet.add(cuisine);
      }
    }

    const cuisines = Array.from(cuisineSet).sort((a, b) => a.localeCompare(b));
    return {
      mode: "tags" as CuisineMode,
      options: cuisines.length > 0 ? ["all", ...cuisines.slice(0, 8)] : ["all"]
    };
  }, [todaysPlaces]);

  const priceOptions = useMemo(() => {
    const tiers = new Set<number>();
    for (const place of todaysPlaces) {
      const tier = getPriceTier(place);
      if (typeof tier === "number" && tier > 0) {
        tiers.add(tier);
      }
    }
    return ["all", ...Array.from(tiers).sort((a, b) => a - b)];
  }, [todaysPlaces]);

  const filtered = useMemo(() => {
    let list = withDistance;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((place) => {
        const name = (
          place.venue?.name ??
          place.venue_name ??
          ""
        ).toLowerCase();
        const orgName = (
          place.orgName ??
          place.organization_name ??
          place.venue?.org_name ??
          ""
        ).toLowerCase();
        const neighborhood = (place.venue?.neighborhood ?? "").toLowerCase();
        const address = (place.venue?.address ?? "").toLowerCase();
        return (
          name.includes(q) ||
          orgName.includes(q) ||
          neighborhood.includes(q) ||
          address.includes(q)
        );
      });
    }

    if (selectedCuisine !== "all") {
      list = list.filter((place) =>
        getPlaceCuisines(place).includes(selectedCuisine)
      );
    }

    if (selectedPrice !== "all") {
      list = list.filter(
        (place) => getPriceTier(place) === selectedPrice
      );
    }

    return list;
  }, [withDistance, query, selectedCuisine, selectedPrice]);

  const cityForMap = useMemo(() => {
    const cityPlace = todaysPlaces.find((place) => place.venue?.city);
    const city = cityPlace?.venue?.city;
    const state = cityPlace?.venue?.state;
    if (city) return `${city}${state ? `, ${state}` : ""}`;
    return null;
  }, [todaysPlaces]);

  const cityLabel = useMemo(() => {
    if (cityForMap) return cityForMap;
    return coords ? "Nearby" : "Set your city";
  }, [cityForMap, coords]);

  const summaryText = useMemo(() => {
    const parts: string[] = ["Today"];
    const priceLabel =
      selectedPrice === "all" ? null : formatPriceTier(selectedPrice);
    const cuisineLabel =
      selectedCuisine === "all"
        ? null
        : formatCuisineLabel(selectedCuisine, cuisineMeta.mode);
    if (priceLabel) parts.push(priceLabel);
    if (cuisineLabel) parts.push(cuisineLabel);
    if (query.trim()) parts.push(`"${query.trim()}"`);
    return parts.join(" | ");
  }, [selectedPrice, selectedCuisine, cuisineMeta.mode, query]);

  const mapLabels = useMemo(() => {
    return filtered.slice(0, 4).map((place) => {
      const price = formatPriceTier(getPriceTier(place));
      const name = getVenueName(place);
      return price ? `${name} - ${price}` : name;
    });
  }, [filtered]);

  const mapMarkerLocations = useMemo(() => {
    return filtered
      .map((place) => formatMapAddress(place))
      .filter((address) => address.length > 0)
      .slice(0, 4);
  }, [filtered]);

  const mapImageUrl = useMemo(() => {
    const provider = (process.env.EXPO_PUBLIC_MAPS_PROVIDER ?? "google").toLowerCase();
    const apiKey = process.env.EXPO_PUBLIC_MAPS_API_KEY ?? "";
    if (!apiKey || provider !== "google") return null;

    const mapWidth = Math.min(640, Math.max(1, Math.floor(width - spacing.lg * 2)));
    const mapHeight = 240;
    const center =
      coords
        ? `${coords.lat},${coords.lng}`
        : mapMarkerLocations[0] ?? cityForMap ?? "United States";

    const params = new URLSearchParams({
      center,
      zoom: coords ? "13" : "11",
      size: `${mapWidth}x${mapHeight}`,
      scale: "2",
      maptype: "roadmap",
      key: apiKey
    });

    if (coords) {
      params.append(
        "markers",
        `color:0x1f2937|label:U|${coords.lat},${coords.lng}`
      );
    }

    mapMarkerLocations.forEach((location, index) => {
      const label = String.fromCharCode(65 + index);
      params.append("markers", `color:0xf97316|label:${label}|${location}`);
    });

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }, [cityForMap, coords, mapMarkerLocations, width]);

  const cardWidth = Math.min(width - spacing.lg * 2, 300);

  if (loading && !refreshing && data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Discover</Text>
        <Text style={styles.pageSubtitle}>
          Loading nearby happy hours for you...
        </Text>
        <LoadingSpinner />
      </View>
    );
  }

  if (error && data.length === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={error.message} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Discover</Text>
          <Text style={styles.pageSubtitle}>
            Find happy hours happening today.
          </Text>

          <View style={styles.searchSummary}>
            <View style={styles.searchIcon}>
              <View style={styles.searchIconCircle} />
              <View style={styles.searchIconHandle} />
            </View>
            <View style={styles.searchText}>
              <Text style={styles.cityText}>{cityLabel}</Text>
              <Text style={styles.summaryText} numberOfLines={1}>
                {summaryText}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                // TODO: open city/date filter editing.
              }}
              style={styles.editButton}
            >
              <View style={styles.editIcon} />
            </Pressable>
          </View>

          <View style={styles.queryRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search bars and restaurants"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.filterLabel}>Cuisine</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {cuisineMeta.options.map((option) => (
              <FilterChip
                key={`cuisine-${option}`}
                label={formatCuisineLabel(option, cuisineMeta.mode)}
                selected={selectedCuisine === option}
                onPress={() => setSelectedCuisine(option)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Price</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {priceOptions.map((option) => {
              const label =
                option === "all" ? "All" : formatPriceTier(option as number);
              return (
                <FilterChip
                  key={`price-${option}`}
                  label={label ?? "All"}
                  selected={selectedPrice === option}
                  onPress={() => setSelectedPrice(option as number | "all")}
                />
              );
            })}
          </ScrollView>

          {locationError && (
            <Text style={styles.locationHint}>
              We could not access your location, so results may not be sorted by
              distance.
            </Text>
          )}
          {!locationError && !coords && (
            <Text style={styles.locationHint}>
              Getting your location to sort nearby happy hours...
            </Text>
          )}
        </View>

        <View style={styles.mapSection}>
          <View style={styles.mapPlaceholder}>
            {mapImageUrl && (
              <Image
                source={{ uri: mapImageUrl }}
                style={styles.mapImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.mapOverlay}>
              {coords && (
                <View style={[styles.mapLabel, styles.mapLabelActive, styles.mapLabelCenter]}>
                  <Text style={styles.mapLabelTextActive}>You Are Here</Text>
                </View>
              )}
              {mapLabels.map((label, index) => (
                <View
                  key={`${label}-${index}`}
                  style={[styles.mapLabel, mapLabelPositions[index]]}
                >
                  <Text style={styles.mapLabelText} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            {!mapImageUrl && (
              <Text style={styles.mapPlaceholderText}>
                Map view placeholder
              </Text>
            )}
          </View>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </Text>
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            title="No matches yet"
            message="Try another cuisine or price tier."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {filtered.map((item) => (
              <VenueCard
                key={item.id}
                place={item}
                width={cardWidth}
              />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
};

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const FilterChip: React.FC<ChipProps> = ({ label, selected, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      selected && styles.chipSelected,
      pressed && styles.chipPressed
    ]}
  >
    <Text style={selected ? styles.chipTextSelected : styles.chipTextUnselected}>
      {label}
    </Text>
  </Pressable>
);

type VenueCardProps = {
  place: HappyHourWindow;
  width: number;
  onSelect?: () => void;
};

const VenueCard: React.FC<VenueCardProps> = ({ place, width, onSelect }) => {   
  const name = getVenueName(place);
  const priceTier = formatPriceTier(getPriceTier(place));

  const ratingRaw =
    (place.venue as any)?.rating ??
    (place as any)?.rating ??
    (place as any)?.avg_rating ??
    null;
  const reviewCountRaw =
    (place.venue as any)?.review_count ??
    (place as any)?.review_count ??
    (place as any)?.reviews_count ??
    null;

  const ratingValue = Number(ratingRaw);
  const reviewCountValue = Number(reviewCountRaw);
  const rating = Number.isFinite(ratingValue) ? ratingValue : null;
  const reviewCount = Number.isFinite(reviewCountValue)
    ? Math.round(reviewCountValue)
    : null;

  const distance = typeof place.distance === "number" ? place.distance : null;
  const distanceText =
    distance == null
      ? null
      : distance < 0.1
        ? "<0.1 mi"
        : `${distance.toFixed(1)} mi`;

  return (
    <Pressable
      onPress={onSelect}
      disabled={!onSelect}
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && styles.cardPressed
      ]}
    >
      <View style={styles.cardHero}>
        <View style={styles.cardHeroDots}>
          <View style={[styles.cardHeroDot, styles.cardHeroDotActive]} />
          <View style={styles.cardHeroDot} />
          <View style={styles.cardHeroDot} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMetaText}>
            {rating != null ? rating.toFixed(1) : "--"}{" "}
            {reviewCount != null ? `(${reviewCount} reviews)` : ""}
          </Text>
          {distanceText && (
            <Text style={styles.cardMetaText}>{distanceText}</Text>
          )}
        </View>
        <View style={styles.cardFooterRow}>
          <Text style={styles.cardPrice}>{priceTier ?? "$$"}</Text>
          {onSelect ? (
            <Pressable
              onPress={onSelect}
              style={({ pressed }) => [
                styles.selectButton,
                pressed && styles.selectButtonPressed
              ]}
            >
              <Text style={styles.selectButtonText}>Select</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

type EmptyStateProps = {
  title: string;
  message: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xl
  },
  header: {
    paddingHorizontal: spacing.lg
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md
  },
  searchSummary: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  searchIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm
  },
  searchIconCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.textMuted
  },
  searchIconHandle: {
    position: "absolute",
    width: 7,
    height: 2,
    backgroundColor: colors.textMuted,
    right: -1,
    bottom: 0,
    transform: [{ rotate: "45deg" }]
  },
  searchText: {
    flex: 1
  },
  cityText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  editIcon: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: colors.textMuted,
    borderRadius: 3
  },
  queryRow: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  searchInput: {
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.sm
  },
  filterRow: {
    paddingBottom: spacing.sm,
    paddingRight: spacing.lg
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: spacing.sm
  },
  chipSelected: {
    backgroundColor: colors.pillActiveBg,
    borderColor: colors.pillActiveBg
  },
  chipPressed: {
    opacity: 0.8
  },
  chipTextSelected: {
    color: colors.pillActiveText,
    fontSize: 13,
    fontWeight: "600"
  },
  chipTextUnselected: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500"
  },
  locationHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs
  },
  mapSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md
  },
  mapPlaceholder: {
    height: 240,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  mapPlaceholderText: {
    color: colors.textMuted,
    fontSize: 12
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  mapLabel: {
    position: "absolute",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    maxWidth: "70%"
  },
  mapLabelText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600"
  },
  mapLabelActive: {
    backgroundColor: colors.pillActiveBg,
    borderColor: colors.pillActiveBg
  },
  mapLabelTextActive: {
    color: colors.pillActiveText,
    fontSize: 12,
    fontWeight: "600"
  },
  mapLabelCenter: {
    top: "45%",
    left: "32%"
  },
  mapLabelPos1: {
    top: 20,
    left: 18
  },
  mapLabelPos2: {
    top: 62,
    right: 16
  },
  mapLabelPos3: {
    bottom: 70,
    left: 22
  },
  mapLabelPos4: {
    bottom: 28,
    right: 30
  },
  resultsHeader: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  carouselContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  card: {
    backgroundColor: colors.card ?? colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md,
    overflow: "hidden"
  },
  cardPressed: {
    opacity: 0.9
  },
  cardHero: {
    height: 150,
    backgroundColor: colors.inputBackground,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: spacing.sm
  },
  cardHeroDots: {
    flexDirection: "row"
  },
  cardHeroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.background,
    opacity: 0.6,
    marginRight: 6
  },
  cardHeroDotActive: {
    backgroundColor: colors.text,
    opacity: 1
  },
  cardBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  cardMetaText: {
    color: colors.textMuted,
    fontSize: 12
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardPrice: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  selectButton: {
    backgroundColor: colors.pillActiveBg,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs
  },
  selectButtonPressed: {
    opacity: 0.85
  },
  selectButtonText: {
    color: colors.pillActiveText,
    fontSize: 12,
    fontWeight: "600"
  },
  emptyState: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: "center"
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xs
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center"
  }
});

const mapLabelPositions = [
  styles.mapLabelPos1,
  styles.mapLabelPos2,
  styles.mapLabelPos3,
  styles.mapLabelPos4
];
