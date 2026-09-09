import { Cover } from "./components/Cover";
import { EssenceSection } from "./components/EssenceSection";
import { LogoSection } from "./components/LogoSection";
import { ColorsSection } from "./components/ColorsSection";
import { TypographySection } from "./components/TypographySection";
import { VoiceSection } from "./components/VoiceSection";
import { SystemSection } from "./components/SystemSection";
import { ApplicationsSection } from "./components/ApplicationsSection";

export function ManualMarca({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ backgroundColor: "#050505" }}>
      {/* Nav overlay with back button */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        padding: "0 48px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(5,5,5,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(216,211,199,0.08)",
      }}>
        <button
          onClick={onBack}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "#77736A",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#D8D3C7")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#77736A")}
        >
          ← CENTRAL
        </button>
        <p style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: "0.28em", color: "#D8D3C7" }}>
          NAVONA
        </p>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.16em", color: "#77736A" }}>
          MANUAL DA MARCA
        </p>
      </div>

      <div style={{ paddingTop: 64 }}>
        <Cover />
        <EssenceSection />
        <LogoSection />
        <ColorsSection />
        <TypographySection />
        <VoiceSection />
        <SystemSection />
        <ApplicationsSection />
      </div>
    </div>
  );
}
