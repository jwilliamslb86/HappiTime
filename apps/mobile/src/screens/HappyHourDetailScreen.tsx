import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Pressable,
  ScrollView,
  useWindowDimensions
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useHappyHours } from "../hooks/useHappyHours";
import { useUserFollowedVenues } from "../hooks/useUserFollowedVenues";
import { useVenueMenus } from "../hooks/useVenueMenus";
import { useUserLocation } from "../hooks/useUserLocation";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorState } from "../components/ErrorState";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { getHappyHourDisplayNames } from "../utils/happyHourDisplay";
import { formatDays, formatTimeRange } from "../utils/formatters";
import { distanceMiles } from "../utils/location";
import { IconSymbol } from "../../components/ui/icon-symbol";

type Props = NativeStackScreenProps<RootStackParamList, "HappyHourDetail">;

const formatPriceTier = (tier?: number | null) =>
  typeof tier === "number" && tier > 0 ? "$".repeat(tier) : null;

export const HappyHourDetailScreen: React.FC<Props> = ({
  route,
  navigation
}) => {
  const { windowId } = route.params;
  const { data, loading: windowsLoading, error: windowsError } = useHappyHours();
  const { coords } = useUserLocation();
  const { width } = useWindowDimensions();
  const {
    isFollowing,
    loading: followLoading,
    savingVenueId,
    toggleFollow
  } = useUserFollowedVenues();

  const window = useMemo(
    () => data.find((w) => w.id === windowId),
    [data, windowId]
  );

  const venue = window?.venue ?? null;
  const venueId = window?.venue_id ?? null;
  const saved = isFollowing(venueId);
  const { titleText, subtitleText } = getHappyHourDisplayNames(window);

  const {
    data: menus,
    loading: menusLoading,
    error: menusError
  } = useVenueMenus(venueId);

  const heroWidth = Math.max(1, width - spacing.lg * 2);
  const heroSlides = [0, 1, 2];

  const distance = useMemo(() => {
    if (!coords || !venue) return null;
    const lat = venue.lat ?? null;
    const lng = venue.lng ?? null;
    if (lat == null || lng == null) return null;
    return distanceMiles(coords.lat, coords.lng, lat, lng);
  }, [coords, venue]);

  const ratingRaw =
    (venue as any)?.rating ??
    (venue as any)?.avg_rating ??
    (window as any)?.rating ??
    null;
  const reviewCountRaw =
    (venue as any)?.review_count ??
    (venue as any)?.reviews_count ??
    (window as any)?.review_count ??
    null;

  const ratingValue = Number(ratingRaw);
  const reviewCountValue = Number(reviewCountRaw);
  const rating = Number.isFinite(ratingValue) ? ratingValue : null;
  const reviewCount = Number.isFinite(reviewCountValue)
    ? Math.round(reviewCountValue)
    : null;

  const priceTier = formatPriceTier(venue?.price_tier);
  const distanceText =
    distance == null
      ? null
      : distance < 0.1
        ? "<0.1 mi"
        : `${distance.toFixed(1)} mi`;

  const relatedWindows = useMemo(() => {
    if (!venue?.city) return [];
    return data
      .filter(
        (item) =>
          item.id !== windowId && item.venue?.city === venue.city
      )
      .slice(0, 4);
  }, [data, venue?.city, windowId]);

  if (windowsLoading && !window) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  if (windowsError && !window) {
    return (
      <View style={styles.container}>
        <ErrorState message={windowsError.message} />
      </View>
    );
  }

  if (!window) {
    return (
      <View style={styles.container}>
        <ErrorState message="We could not find this happy hour window." />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.container}>
        <ErrorState message="Venue details are not available yet." />
      </View>
    );
  }

  const openWebsite = () => {
    if (!venue.website) return;
    Linking.openURL(venue.website).catch(() => {});
  };

  const callVenue = () => {
    if (!venue.phone) return;
    const url = `tel:${venue.phone}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleSelect = () => {
    // TODO: hook up to booking or selection flow when available.
  };

  const handleToggleSave = async () => {
    if (!venueId || followLoading) return;
    await toggleFollow(venueId);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroWrap}>
          <View style={[styles.heroCard, { width: heroWidth }]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={[styles.heroScroll, { width: heroWidth }]}
              contentContainerStyle={[
                styles.heroContent,
                { width: heroWidth * heroSlides.length }
              ]}
            >
              {heroSlides.map((slide) => (
                <View
                  key={slide}
                  style={[styles.heroSlide, { width: heroWidth }]}
                />
              ))}
            </ScrollView>
            <View style={styles.heroDots}>
              <View style={[styles.heroDot, styles.heroDotActive]} />
              <View style={styles.heroDot} />
              <View style={styles.heroDot} />
            </View>
          </View>
          <View style={styles.heroButtons}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.heroButton,
                styles.heroButtonLeft,
                pressed && styles.heroButtonPressed
              ]}
            >
              <Text style={styles.heroButtonText}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleSelect}
              style={({ pressed }) => [
                styles.heroButton,
                styles.heroButtonRight,
                pressed && styles.heroButtonPressed
              ]}
            >
              <Text style={styles.heroButtonText}>Select</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{titleText}</Text>
          {subtitleText && (
            <Text style={styles.subtitle}>{subtitleText}</Text>
          )}
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              {rating != null && (
                <View style={styles.metaItem}>
                  <IconSymbol name="star.fill" size={14} color={colors.text} />
                  <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
                </View>
              )}
              {reviewCount != null && (
                <Text style={styles.metaSubtext}>
                  {rating != null
                    ? `(${reviewCount} reviews)`
                    : `${reviewCount} reviews`}
                </Text>
              )}
              {priceTier && (
                <Text style={styles.metaSubtext}>{priceTier}</Text>
              )}
            </View>
            {distanceText && (
              <View style={styles.metaRight}>
                <IconSymbol
                  name="mappin.circle.fill"
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={styles.metaDistanceText}>{distanceText}</Text>
              </View>
            )}
          </View>
          {venue.address && (
            <Text style={styles.address}>
              {venue.address}
              {venue.city ? `, ${venue.city}` : ""}
              {venue.state ? `, ${venue.state}` : ""}
              {venue.zip ? ` ${venue.zip}` : ""}
            </Text>
          )}
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>When</Text>
            <Text style={styles.detailValue}>
              {formatTimeRange(window.start_time, window.end_time)}{" "}
              {window.timezone ? `(${window.timezone})` : ""}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Days</Text>
            <Text style={styles.detailValue}>{formatDays(window.dow)}</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu Preview</Text>

          {menusError && (
            <Text style={styles.menuError}>
              Could not load menu: {menusError.message}
            </Text>
          )}

          {menusLoading && (
            <Text style={styles.menuLoading}>Loading menu...</Text>
          )}

          {!menusLoading && menus.length > 0 && (
            <View style={styles.menuList}>
              {menus.map((menu) => (
                <View key={menu.id} style={styles.menuBlock}>
                  {menus.length > 1 && (
                    <Text style={styles.menuName}>{menu.name}</Text>
                  )}
                  {menu.sections.map((section) => (
                    <View key={section.id} style={styles.menuSectionBlock}>
                      {menu.sections.length > 1 && (
                        <Text style={styles.menuSectionName}>
                          {section.name}
                        </Text>
                      )}
                      {section.items.map((item, index) => (
                        <View key={item.id} style={styles.menuRow}>
                          <View
                            style={[
                              styles.menuDot,
                              index === 0
                                ? styles.menuDotActive
                                : styles.menuDotInactive
                            ]}
                          />
                          <View style={styles.menuTextWrap}>
                            <Text style={styles.menuItemText}>
                              {item.name}
                              {item.price != null
                                ? ` - $${Number(item.price).toFixed(2)}`
                                : ""}
                            </Text>
                            {item.description && (
                              <Text style={styles.menuItemDescription}>
                                {item.description}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {!menusLoading && menus.length === 0 && (
            <Text style={styles.menuEmpty}>
              Menu coming soon.
              {/* TODO: Show menu items once the venue adds them. */}
            </Text>
          )}
        </View>

        {!menusLoading && menus.length === 0 && relatedWindows.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.sectionTitle}>Nearby venues</Text>
            {relatedWindows.map((item, index) => {
              const name =
                item.venue?.app_name_preference ??
                item.venue?.name ??
                item.venue_name ??
                "Venue";
              const price = formatPriceTier(item.venue?.price_tier) ?? "$$";
              return (
                <View key={item.id} style={styles.relatedRow}>
                  <View
                    style={[
                      styles.menuDot,
                      index === 0
                        ? styles.menuDotActive
                        : styles.menuDotInactive
                    ]}
                  />
                  <Text style={styles.relatedText}>
                    {name} - {price}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
              (followLoading || savingVenueId === venueId) &&
                styles.actionButtonDisabled
            ]}
            onPress={handleToggleSave}
            disabled={followLoading || savingVenueId === venueId}
          >
            <Text style={styles.actionText}>
              {saved ? "Saved" : "Save"}
            </Text>
          </Pressable>
          {venue.website && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed
              ]}
              onPress={openWebsite}
            >
              <Text style={styles.actionText}>View Website</Text>
            </Pressable>
          )}
          {venue.phone && (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed
              ]}
              onPress={callVenue}
            >
              <Text style={styles.actionText}>Call</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xl
  },
  heroWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  heroCard: {
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
    overflow: "hidden"
  },
  heroScroll: {
    flex: 1
  },
  heroContent: {
    height: "100%"
  },
  heroSlide: {
    height: "100%",
    backgroundColor: colors.inputBackground
  },
  heroDots: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row"
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.background,
    opacity: 0.6,
    marginRight: 6
  },
  heroDotActive: {
    backgroundColor: colors.text,
    opacity: 1
  },
  heroButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md
  },
  heroButton: {
    flex: 1,
    backgroundColor: colors.pillActiveBg,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    alignItems: "center"
  },
  heroButtonLeft: {
    marginRight: spacing.sm
  },
  heroButtonRight: {
    marginLeft: spacing.sm
  },
  heroButtonPressed: {
    opacity: 0.85
  },
  heroButtonText: {
    color: colors.pillActiveText,
    fontSize: 14,
    fontWeight: "600"
  },
  infoSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.sm
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.sm
  },
  metaText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4
  },
  metaSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginRight: spacing.sm
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  metaDistanceText: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 4
  },
  address: {
    color: colors.textMuted,
    fontSize: 13
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  detailItem: {
    flex: 1,
    marginRight: spacing.md
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 2
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500"
  },
  menuSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm
  },
  menuList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  menuBlock: {
    marginBottom: spacing.md
  },
  menuName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: spacing.xs
  },
  menuSectionBlock: {
    marginBottom: spacing.sm
  },
  menuSectionName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm
  },
  menuDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: spacing.md,
    marginTop: 4
  },
  menuDotActive: {
    backgroundColor: colors.text
  },
  menuDotInactive: {
    backgroundColor: colors.border
  },
  menuTextWrap: {
    flex: 1
  },
  menuItemText: {
    color: colors.textMuted,
    fontSize: 13
  },
  menuItemDescription: {
    color: colors.textMuted,
    fontSize: 12
  },
  menuEmpty: {
    color: colors.textMuted,
    fontSize: 13
  },
  menuError: {
    color: colors.error,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  menuLoading: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  relatedSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  relatedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm
  },
  relatedText: {
    color: colors.textMuted,
    fontSize: 13
  },
  actions: {
    paddingHorizontal: spacing.lg
  },
  actionButton: {
    backgroundColor: colors.pillActiveBg,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.sm
  },
  actionButtonPressed: {
    opacity: 0.85
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionText: {
    color: colors.pillActiveText,
    fontSize: 14,
    fontWeight: "600"
  }
});
