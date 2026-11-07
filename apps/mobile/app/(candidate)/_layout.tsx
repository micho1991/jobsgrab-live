import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { TabIcon } from "@/components/tab-icon";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function CandidateTabs() {
  const { session } = useAuth();
  const [unread, setUnread] = useState(0);

  // Live unread count: Supabase Realtime pushes new notifications as HR acts.
  useEffect(() => {
    if (!session) return;
    const load = async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      setUnread(count ?? 0);
    };
    void load();
    const channel = supabase.channel(`notifications-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session]);

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.muted,
      headerTintColor: colors.ink, headerTitleStyle: { fontWeight: "600" },
      tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
      // Web has no bottom safe-area inset, so give labels room below them; native keeps the platform default.
      tabBarStyle: Platform.OS === "web" ? { height: 58, paddingBottom: 6 } : undefined,
    }}>
      <Tabs.Screen name="index" options={{ title: "Jobs", headerTitle: "Open positions", tabBarIcon: ({ color }) => <TabIcon name="jobs" color={color} /> }} />
      <Tabs.Screen name="applications" options={{ title: "Applications", tabBarIcon: ({ color }) => <TabIcon name="applications" color={color} /> }} />
      <Tabs.Screen name="updates" options={{
        title: "Updates", tabBarIcon: ({ color }) => <TabIcon name="updates" color={color} />,
        tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: colors.ink },
      }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <TabIcon name="account" color={color} /> }} />
    </Tabs>
  );
}
