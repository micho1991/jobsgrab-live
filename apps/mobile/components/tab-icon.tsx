import { View, type ColorValue } from "react-native";

/** Minimal line icons drawn with Views, so the app needs no icon font. */
export function TabIcon({ name, color }: { name: "jobs" | "applications" | "updates" | "account" | "overview"; color: ColorValue }) {
  const line = { backgroundColor: color, borderRadius: 1 } as const;
  // 22px keeps icon + label inside the standard 49pt tab bar.
  const box = { width: 22, height: 22, alignItems: "center", justifyContent: "center" } as const;
  switch (name) {
    case "jobs": // briefcase
      return (
        <View style={box}>
          <View style={{ width: 8, height: 4, borderWidth: 1.8, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          <View style={{ width: 20, height: 13, borderWidth: 1.8, borderColor: color, borderRadius: 3 }} />
        </View>
      );
    case "applications": // document with lines
      return (
        <View style={box}>
          <View style={{ width: 15, height: 19, borderWidth: 1.8, borderColor: color, borderRadius: 3, padding: 3, gap: 3, justifyContent: "center" }}>
            <View style={[line, { height: 1.8, width: 8 }]} /><View style={[line, { height: 1.8, width: 6 }]} />
          </View>
        </View>
      );
    case "updates": // bell
      return (
        <View style={box}>
          <View style={{ width: 16, height: 15, borderWidth: 1.8, borderColor: color, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomWidth: 0 }} />
          <View style={[line, { width: 20, height: 1.8 }]} />
          <View style={{ width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: color, marginTop: 1 }} />
        </View>
      );
    case "overview": // bar chart
      return (
        <View style={[box, { flexDirection: "row", alignItems: "flex-end", gap: 3, paddingBottom: 3 }]}>
          {[7, 14, 10, 17].map((h, i) => <View key={i} style={[line, { width: 3.5, height: h }]} />)}
        </View>
      );
    case "account": // person
      return (
        <View style={box}>
          <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.8, borderColor: color }} />
          <View style={{ width: 17, height: 8, borderWidth: 1.8, borderColor: color, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0, marginTop: 2 }} />
        </View>
      );
  }
}
