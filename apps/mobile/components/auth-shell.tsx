import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PROGRESS_STEPS, STATUS_META } from "@hr/shared";
import { env } from "@/lib/env";
import { colors } from "@/lib/theme";

/** Navy brand band + the hiring journey, echoing the web sign-in panel. */
export function AuthShell({ title, subtitle, children, showJourney }: {
  title: string; subtitle?: React.ReactNode; children: React.ReactNode; showJourney?: boolean;
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: colors.deep }}>
          <SafeAreaView edges={["top"]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22, gap: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.deep, fontWeight: "700", fontSize: 15 }}>{env.companyName.charAt(0)}</Text>
                </View>
                <Text style={{ color: colors.white, fontSize: 17, fontWeight: "600" }}>
                  {env.companyName} <Text style={{ color: colors.steelLight, fontWeight: "500" }}>Careers</Text>
                </Text>
              </View>
              {showJourney && (
                <View accessible accessibilityLabel={`Applications move through ${PROGRESS_STEPS.length} stages, from submitted to hired.`}
                  style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch" }}>
                  {PROGRESS_STEPS.flatMap((st, i) => {
                    const on = i < 4;
                    const dot = (
                      <View key={st} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, flexShrink: 0, borderColor: on ? colors.white : "rgba(255,255,255,0.3)", backgroundColor: on ? colors.white : "transparent", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: on ? colors.deep : colors.steelLight }}>{i + 1}</Text>
                      </View>
                    );
                    if (i === PROGRESS_STEPS.length - 1) return [dot];
                    return [dot, <View key={`${st}-line`} style={{ flex: 1, minWidth: 4, height: 1, backgroundColor: i < 3 ? colors.white : "rgba(255,255,255,0.2)" }} />];
                  })}
                </View>
              )}
              {showJourney && (
                <Text style={{ color: colors.steelLight, fontSize: 14, lineHeight: 20 }}>
                  Apply once, then follow your application from {STATUS_META.submitted.label.toLowerCase()} to {STATUS_META.hired.label.toLowerCase()}.
                </Text>
              )}
            </View>
          </SafeAreaView>
        </View>
        <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
          <View style={{ padding: 20, gap: 18, flex: 1 }}>
            <View style={{ gap: 6 }}>
              <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 }}>{title}</Text>
              {subtitle && <Text style={{ fontSize: 15, lineHeight: 21, color: colors.muted }}>{subtitle}</Text>}
            </View>
            {children}
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
