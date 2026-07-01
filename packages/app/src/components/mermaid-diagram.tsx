"use dom";

// Expo DOM component: renders a Mermaid diagram. On web this runs directly in
// the DOM; on native Expo hosts it inside a WebView automatically. Mermaid is a
// browser library (needs a DOM to render SVG), so this is the cross-platform
// seam. Theme colors are injected from the RN side (see mermaid-block.tsx) so
// the diagram matches the active Paseo theme.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DOMProps } from "expo/dom";
import mermaid from "mermaid";

export interface MermaidThemeColors {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
}

const DIAGRAM_CONTAINER_STYLE: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
  overflowX: "auto",
};

let renderSeq = 0;

export default function MermaidDiagram({
  code,
  themeColors,
}: {
  code: string;
  themeColors: MermaidThemeColors;
  dom?: DOMProps;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string>(`mmd-${(renderSeq += 1)}`);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        background: themeColors.background,
        primaryColor: themeColors.background,
        primaryBorderColor: themeColors.border,
        primaryTextColor: themeColors.foreground,
        secondaryColor: themeColors.border,
        tertiaryColor: themeColors.background,
        lineColor: themeColors.muted,
        textColor: themeColors.foreground,
        mainBkg: themeColors.background,
        nodeBorder: themeColors.border,
        clusterBkg: themeColors.background,
        clusterBorder: themeColors.border,
        fontSize: "14px",
      },
    });
    const run = async () => {
      try {
        const result = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvg(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    code,
    themeColors.background,
    themeColors.foreground,
    themeColors.muted,
    themeColors.border,
    themeColors.accent,
  ]);

  const errorStyle = useMemo<CSSProperties>(
    () => ({
      margin: 0,
      padding: 12,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      color: themeColors.foreground,
      background: themeColors.background,
      border: `1px solid ${themeColors.border}`,
      borderRadius: 8,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
    }),
    [themeColors.foreground, themeColors.background, themeColors.border],
  );

  const loadingStyle = useMemo<CSSProperties>(
    () => ({ color: themeColors.muted, fontSize: 12, padding: 8 }),
    [themeColors.muted],
  );

  const innerHtml = useMemo(() => ({ __html: svg ?? "" }), [svg]);

  if (error) {
    // Fall back to the raw source so a malformed diagram still shows its text.
    return <pre style={errorStyle}>{code}</pre>;
  }

  if (!svg) {
    return <div style={loadingStyle}>Rendering diagram…</div>;
  }

  // Mermaid output is sanitized by securityLevel: "strict".
  return <div style={DIAGRAM_CONTAINER_STYLE} dangerouslySetInnerHTML={innerHtml} />;
}
