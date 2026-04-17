// src/navigation/index.tsx
import React from "react";
import {
  NavigationContainer,
  DefaultTheme
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { RootStackParamList, MainTabParamList } from "./types";
import { useAuth } from "../hooks/useAuth";
import { AuthScreen } from "../screens/AuthScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { HappyHourDetailScreen } from "../screens/HappyHourDetailScreen";
import { ActivityScreen } from "../screens/ActivityScreen";
import { FavoritesScreen } from "../screens/FavoritesScreen";
import { AddScreen } from "../screens/AddScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { colors } from "../theme/colors";
import { StyleSheet, View } from "react-native";
import { IconSymbol } from "../../components/ui/icon-symbol";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme: typeof DefaultTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card ?? colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.primary
  }
};

function AppTabs() {
  const unreadCount: number | null = null;
  // TODO: wire unreadCount to activity/notification state.
  const badgeCount =
    typeof unreadCount === "number" && unreadCount > 0
      ? unreadCount
      : undefined;

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: keyof MainTabParamList } }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 16,
          paddingTop: 8
        },
        tabBarBackground: () => (
          <View pointerEvents="none" style={styles.tabBarBackground}>
            <View style={styles.homeIndicator} />
          </View>
        ),
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.tabBarInactiveTint,
        tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => {
          let name:
            | "house.fill"
            | "magnifyingglass"
            | "plus.circle.fill"
            | "bell.fill"
            | "person.crop.circle.fill" = "house.fill";
          let size = 24;

          if (route.name === "Home") name = "house.fill";
          if (route.name === "Favorites") name = "magnifyingglass";
          if (route.name === "Add") {
            name = "plus.circle.fill";
            size = 30;
          }
          if (route.name === "Activity") name = "bell.fill";
          if (route.name === "Profile") name = "person.crop.circle.fill";

          return (
            <IconSymbol
              name={name}
              size={size}
              color={color}
              weight={focused ? "semibold" : "regular"}
            />
          );
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarBadge: badgeCount,
          tabBarBadgeStyle: styles.tabBarBadge
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export const AppNavigation: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false
        }}
      >
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="AppTabs" component={AppTabs} />
            <Stack.Screen
              name="HappyHourDetail"
              component={HappyHourDetailScreen}
              options={{
                headerShown: true,
                title: "Details",
                headerTintColor: colors.text,
                headerStyle: { backgroundColor: colors.background }
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigation;

const styles = StyleSheet.create({
  tabBarBackground: {
    flex: 1,
    backgroundColor: colors.tabBarBackground,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6
  },
  homeIndicator: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text
  },
  tabBarBadge: {
    backgroundColor: colors.error,
    color: colors.surface,
    fontSize: 11,
    fontWeight: "600",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    lineHeight: 18,
    textAlign: "center"
  }
});
