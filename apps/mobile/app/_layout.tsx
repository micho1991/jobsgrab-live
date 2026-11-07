import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isHrRole } from "@hr/shared";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";
import { colors } from "@/lib/theme";

/** Sends people to the right area: sign-in, candidate tabs or HR tabs. */
function Gate() {
  const { loading, session, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    const hr = isHrRole(profile?.role);
    if (!session) {
      if (group !== "(auth)" && group !== "auth") router.replace("/sign-in");
    } else if (profile) {
      if (group === "(auth)" || group === "auth" || group === undefined) router.replace(hr ? "/hr" : "/(candidate)");
      else if (hr && (group === "(candidate)" || group === "apply" || group === "application")) router.replace("/hr");
      else if (!hr && (group === "hr" || group === "hr-application")) router.replace("/(candidate)");
    }
  }, [loading, session, profile, segments, router]);

  if (loading) return <Loading />;
  return (
    <Stack screenOptions={{
      headerTintColor: colors.ink, headerStyle: { backgroundColor: colors.white },
      headerTitleStyle: { fontWeight: "600" }, contentStyle: { backgroundColor: colors.mist }, headerBackTitle: "Back",
    }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(candidate)" options={{ headerShown: false }} />
      <Stack.Screen name="hr" options={{ headerShown: false }} />
      <Stack.Screen name="apply/[id]" options={{ title: "Apply", presentation: "card" }} />
      <Stack.Screen name="application/[id]" options={{ title: "Application" }} />
      <Stack.Screen name="hr-application/[id]" options={{ title: "Application" }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
