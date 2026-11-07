import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { TabIcon } from "@/components/tab-icon";
import { colors } from "@/lib/theme";

export default function HrTabs() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.muted,
      headerTintColor: colors.ink, headerTitleStyle: { fontWeight: "600" }, tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
      // Web has no bottom safe-area inset, so give labels room below them; native keeps the platform default.
      tabBarStyle: Platform.OS === "web" ? { height: 58, paddingBottom: 6 } : undefined,
    }}>
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: ({ color }) => <TabIcon name="overview" color={color} /> }} />
      <Tabs.Screen name="applications" options={{ title: "Applications", tabBarIcon: ({ color }) => <TabIcon name="applications" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <TabIcon name="account" color={color} /> }} />
    </Tabs>
  );
}
