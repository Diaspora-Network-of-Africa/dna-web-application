// Ported from profile/strand-patch/Profile.jsx (B3-Profile-v3, rulings 130, 135). Mounted inside
// Sheet (bottom sheet under 640, 560 drawer otherwise): C-tint head, the copy from C_INFO, the
// attestation rail, and a footer with previous, Join DNA (Connect green), next.
import type { ReactNode } from "react";
import { AttestationRail, type AttestationItem } from "./AttestationRail";
import { Button } from "@/components/strand/Button";
import { CBadge } from "@/components/strand/CBadge";
import { IconButton } from "@/components/strand/IconButton";
import { CAPS } from "./SectionCard";
import { C_INFO } from "./cinfo";
import type { C } from "@/components/strand/cmeta";

export type CSheetBodyProps = {
  c: C;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onSignIn?: (() => void) | undefined;
  attestations?: Partial<Record<C, AttestationItem[]>>;
  onOpenAttestation?: ((item: AttestationItem) => void) | undefined;
};

function H({ children }: { children: ReactNode }) {
  return <h3 style={{ ...CAPS, marginTop: 8 }}>{children}</h3>;
}

export function CSheetBody({
  c,
  onPrev,
  onNext,
  onSignIn,
  attestations = {},
  onOpenAttestation,
}: CSheetBodyProps) {
  const info = C_INFO[c];
  return (
    <div
      data-testid="c-sheet"
      data-c={c}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "24px 24px",
          background: "var(--c-" + c + "-tint)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <CBadge c={c} size={48} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.1,
              color: "var(--c-" + c + "-text)",
            }}
          >
            {info.label}
          </span>
          <span style={{ fontSize: 17, color: "var(--ink-2)", lineHeight: 1.4 }}>{info.line}</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 24px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontSize: 17,
          lineHeight: 1.55,
        }}
      >
        <H>Overview</H>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 22,
            lineHeight: 1.35,
            textWrap: "pretty",
          }}
        >
          {info.overview}
        </p>
        <H>What you can do</H>
        <ul
          style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}
        >
          {info.can.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <H>Who it is for</H>
        <p style={{ margin: 0 }}>{info.who}</p>
        <H>How it connects to the other Cs</H>
        <p style={{ margin: 0 }}>{info.links}</p>
      </div>
      <AttestationRail c={c} items={attestations[c] || []} onOpen={onOpenAttestation} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 20px",
          borderTop: "1px solid var(--line)",
        }}
      >
        <IconButton name="arrow-left" label="Previous C" onClick={onPrev} />
        <span style={{ flex: 1 }} />
        <Button c="connect" onClick={onSignIn}>
          Join DNA
        </Button>
        <span style={{ flex: 1 }} />
        <IconButton name="chevron-right" label="Next C" onClick={onNext} />
      </div>
    </div>
  );
}
