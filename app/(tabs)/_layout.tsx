import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useLanguage } from "@/contexts/language-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  // Use standard tab bar on mobile for better text rendering
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: isWeb ? {
          // Floating style for web
          position: "absolute",
          bottom: Math.max(insets.bottom, 16),
          left: 16,
          right: 16,
          height: 64,
          borderRadius: Radius.xl,
          backgroundColor: colors.card,
          borderTopWidth: 0,
          paddingHorizontal: 4,
          ...Shadows.lg,
        } : {
          // Standard style for mobile - more reliable text rendering
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 85 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarItemStyle: isWeb ? {
          height: 64,
          paddingTop: 10,
          paddingBottom: 12,
          justifyContent: "flex-start",
        } : {
          height: 77,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          lineHeight: 14,
          marginTop: 4,
        },
        tabBarIconStyle: {
          width: 24,
          height: 24,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav_scanner"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : styles.iconContainer}>
              <IconSymbol size={22} name="qrcode.viewfinder" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="checkpoints"
        options={{
          title: t("nav_checkpoints"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : styles.iconContainer}>
              <IconSymbol size={22} name="location.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="participants"
        options={{
          title: t("nav_pilgrims"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : styles.iconContainer}>
              <IconSymbol size={22} name="person.2.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("nav_reports"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : styles.iconContainer}>
              <IconSymbol size={22} name="chart.bar.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav_settings"),
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconContainer : styles.iconContainer}>
              <IconSymbol size={22} name="gearshape.fill" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  activeIconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(196, 133, 47, 0.12)",
    borderRadius: 10,
  },
});
