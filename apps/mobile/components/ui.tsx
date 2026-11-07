import { useState } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { STATUS_META, type ApplicationStatus } from "@hr/shared";
import { colors, radius, statusTone } from "@/lib/theme";

// ------------------------------------------------------------------ layout --
export function Screen({ children, refreshing, onRefresh, edges = ["bottom"], contentStyle }: {
  children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void;
  edges?: ("top" | "bottom")[]; contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.mist }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.screen, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style, title, right }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; title?: string; right?: React.ReactNode }) {
  return (
    <View style={[s.card, style]}>
      {title && (
        <View style={s.cardHeader}>
          <Text style={s.h3} accessibilityRole="header">{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

// -------------------------------------------------------------- typography --
export const H1 = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) =>
  <Text style={[s.h1, style]} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) =>
  <Text style={[s.h2, style]} accessibilityRole="header">{children}</Text>;
export const Body = ({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) =>
  <Text style={[s.body, style]} numberOfLines={numberOfLines}>{children}</Text>;
export const Muted = ({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) =>
  <Text style={[s.muted, style]} numberOfLines={numberOfLines}>{children}</Text>;

// ----------------------------------------------------------------- buttons --
type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ title, onPress, variant = "primary", loading, disabled, style, small, ...rest }:
  Omit<PressableProps, "style"> & { title: string; variant?: Variant; loading?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const v = btn[variant];
  return (
    <Pressable accessibilityRole="button" aria-disabled={!!(disabled || loading)} aria-busy={!!loading}
      onPress={onPress} disabled={disabled || loading} {...rest}
      style={({ pressed }) => [s.btn, small && s.btnSmall, v.box, pressed && v.pressed, (disabled || loading) && { opacity: 0.6 }, style]}>
      {loading && <ActivityIndicator size="small" color={v.text.color} style={{ marginRight: 8 }} />}
      <Text style={[s.btnText, small && { fontSize: 14 }, v.text]}>{title}</Text>
    </Pressable>
  );
}

export function LinkText({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={s.link} suppressHighlighting>{children}</Text>
  );
}

// ------------------------------------------------------------------ fields --
export function TextField({ label, error, hint, optional, style, multiline, ...props }:
  TextInputProps & { label: string; error?: string; hint?: string; optional?: boolean }) {
    const [focused, setFocused] = useState(false);
    return (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.label}>{label}</Text>
          {optional && <Text style={[s.muted, { fontSize: 12 }]}>Optional</Text>}
        </View>
        <TextInput accessibilityLabel={label} placeholderTextColor="#8A96A6" multiline={multiline}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }} onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[s.input, multiline && { minHeight: 120, paddingTop: 10, textAlignVertical: "top" }, focused && { borderColor: colors.ink }, !!error && { borderColor: colors.bad }, style]}
          {...props} />
        {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text style={[s.muted, { fontSize: 13 }]}>{hint}</Text> : null}
      </View>
    );
}

export function Checkbox({ checked, onChange, label, error }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; error?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable accessibilityRole="checkbox" aria-checked={checked} onPress={() => onChange(!checked)} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={[s.checkbox, checked && { backgroundColor: colors.ink, borderColor: colors.ink }, !!error && !checked && { borderColor: colors.bad }]}>
          {checked && <Text style={{ color: colors.white, fontSize: 13, fontWeight: "700" }}>✓</Text>}
        </View>
        <Text style={[s.body, { flex: 1, fontSize: 15 }]}>{label}</Text>
      </Pressable>
      {error && <Text style={[s.error, { marginLeft: 34 }]}>{error}</Text>}
    </View>
  );
}

// --------------------------------------------------------------- feedback --
export function Banner({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const t = { info: [colors.infoBg, colors.ink], error: [colors.badBg, colors.bad], success: [colors.okBg, colors.ok] }[tone];
  return (
    <View accessibilityRole={tone === "error" ? "alert" : "summary"} style={[s.banner, { backgroundColor: t[0] }]}>
      <Text style={{ color: t[1], fontSize: 15, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status];
  const t = statusTone[meta.tone]!;
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.fg, fontSize: 13, fontWeight: "600" }}>{meta.label}</Text>
    </View>
  );
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}><ActivityIndicator color={colors.ink} /></View>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 16, gap: 6 }}>
      <Text style={[s.body, { fontWeight: "600", color: colors.ink }]}>{title}</Text>
      {body && <Text style={[s.muted, { textAlign: "center" }]}>{body}</Text>}
      {action && <View style={{ marginTop: 10 }}>{action}</View>}
    </View>
  );
}

export function Row({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: colors.mist }]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" aria-selected={selected}
      style={[s.chip, selected && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      <Text style={{ fontSize: 14, color: selected ? colors.white : colors.body }}>{label}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ styles --
const btn: Record<Variant, { box: ViewStyle; pressed: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: colors.ink }, pressed: { backgroundColor: colors.inkPressed }, text: { color: colors.white } },
  secondary: { box: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, pressed: { backgroundColor: colors.mist }, text: { color: colors.ink } },
  ghost: { box: { backgroundColor: "transparent" }, pressed: { backgroundColor: colors.mist }, text: { color: colors.ink } },
  danger: { box: { backgroundColor: colors.white, borderWidth: 1, borderColor: "#E9B9B4" }, pressed: { backgroundColor: colors.badBg }, text: { color: colors.bad } },
};

export const s = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.white, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  h1: { fontSize: 28, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: "700", color: colors.ink, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: "600", color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.body },
  muted: { fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, paddingHorizontal: 12, fontSize: 16, color: colors.body, backgroundColor: colors.white },
  error: { color: colors.bad, fontSize: 14 },
  link: { color: colors.ink, fontWeight: "600", textDecorationLine: "underline" },
  btn: { minHeight: 48, borderRadius: radius.control, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  btnSmall: { minHeight: 36, paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: "600" },
  banner: { borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 11 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.steel, alignItems: "center", justifyContent: "center", marginTop: 1, backgroundColor: colors.white },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.white },
});
