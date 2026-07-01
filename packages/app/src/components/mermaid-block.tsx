import { View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import MermaidDiagram, { type MermaidThemeColors } from "@/components/mermaid-diagram";

// matchContents sizes the native WebView to the diagram; ignored on web.
const DOM_PROPS = { matchContents: true, scrollEnabled: false } as const;

// Plain RN wrapper so withUnistyles can inject theme colors here (it cannot wrap
// the "use dom" component directly without dropping its `dom` prop). This passes
// `dom` through to the DOM component, whose type accepts it.
function MermaidInner({ code, themeColors }: { code: string; themeColors: MermaidThemeColors }) {
  return <MermaidDiagram code={code} themeColors={themeColors} dom={DOM_PROPS} />;
}

// useUnistyles() is forbidden in this repo (docs/unistyles.md); withUnistyles is
// the sanctioned reactive path for feeding theme values into a component.
const ThemedMermaidInner = withUnistyles(MermaidInner, (theme) => ({
  themeColors: {
    background: theme.colors.background,
    foreground: theme.colors.foreground,
    muted: theme.colors.foregroundMuted,
    border: theme.colors.border,
    accent: theme.colors.accent,
  },
}));

export function MermaidBlock({ code }: { code: string }) {
  const trimmed = code.replace(/\n+$/, "");
  if (!trimmed.trim()) {
    return null;
  }
  return (
    <View style={styles.container}>
      <ThemedMermaidInner code={trimmed} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 8,
  },
});
