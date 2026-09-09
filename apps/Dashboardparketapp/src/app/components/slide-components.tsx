import React from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

/* ─── Design tokens ─── */
const BEGRAY = "#B8AA9A";
const BEGRAY_DIM = "rgba(184,170,154,0.35)";
const BORDER = "rgba(255,255,255,0.06)";
const BG = "#0A0A0A";

/* ─── CSS animation helper ─── */
const fadeStyle = (delay = 0): React.CSSProperties => ({
  animation: `slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s both`,
});

/* ─── Cover Slide (vertical) ─── */
export function CoverSlide({
  title,
  subtitle,
  image,
}: {
  title: string;
  subtitle?: string;
  image: string;
  label?: string;
  logo?: string;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: BG }}>
      <div className="absolute inset-0">
        <ImageWithFallback src={image} alt="" className="w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BG} 0%, ${BG}dd 40%, ${BG}99 70%, ${BG}66 100%)` }} />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">
        <div style={{ ...fadeStyle(0.1), background: BEGRAY }} className="h-px w-8 mb-12" />
        <h1
          style={{ ...fadeStyle(0.2), fontSize: "clamp(1.4rem, 6vw, 2.3rem)", lineHeight: 0.95, fontWeight: 300, letterSpacing: "0.18em" }}
          className="text-white uppercase"
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{ ...fadeStyle(0.4), fontSize: "clamp(0.7rem, 2vw, 0.85rem)", lineHeight: 1.8, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}
            className="mt-8 max-w-xs"
          >
            {subtitle}
          </p>
        )}
        <div style={{ ...fadeStyle(0.5), background: BEGRAY }} className="mt-12 h-px w-8" />
      </div>
    </div>
  );
}

/* ─── Section Divider ─── */
export function SectionSlide({
  block,
  title,
  subtitle,
}: {
  block: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center px-8" style={{ background: BG }}>
      <div className="text-center max-w-sm">
        <span
          style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }}
          className="inline-block tracking-[0.35em] uppercase mb-6"
        >
          {block}
        </span>
        <div style={{ ...fadeStyle(0.15), background: BEGRAY_DIM }} className="mx-auto mb-6 h-px w-8" />
        <h2
          style={{ ...fadeStyle(0.2), fontSize: "clamp(1.8rem, 7vw, 2.8rem)", lineHeight: 1.1, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight whitespace-pre-line"
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ ...fadeStyle(0.3), fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(255,255,255,0.4)" }} className="mt-4 max-w-xs mx-auto">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Split Slide (vertical: image top, text bottom) ─── */
export function SplitSlide({
  title,
  subtitle,
  content,
  image,
  label,
  items,
  bullets,
}: {
  title: string;
  subtitle?: string;
  content?: string;
  image: string;
  label?: string;
  imagePosition?: "left" | "right";
  items?: string[];
  bullets?: string[];
}) {
  const list = items || bullets || [];
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: BG }}>
      {/* Image top 40% */}
      <div className="relative w-full" style={{ flex: "0 0 38%" }}>
        <ImageWithFallback src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BG} 0%, transparent 60%)` }} />
      </div>
      {/* Content bottom */}
      <div className="flex-1 px-8 sm:px-12 py-6 overflow-y-auto">
        {label && (
          <p style={{ ...fadeStyle(0.05), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.1), fontSize: "clamp(1.4rem, 5vw, 2rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight whitespace-pre-line"
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ ...fadeStyle(0.12), fontSize: "0.8rem", lineHeight: 1.6, color: BEGRAY }} className="mt-2">
            {subtitle}
          </p>
        )}
        {content && (
          <p style={{ ...fadeStyle(0.15), fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }} className="mt-4">
            {content}
          </p>
        )}
        {list.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {list.map((item, i) => (
              <li key={i} style={{ ...fadeStyle(0.15 + i * 0.04), fontSize: "0.8rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }} className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: BEGRAY }} />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Content Slide ─── */
export function ContentSlide({
  title,
  subtitle,
  content,
  label,
  highlight,
  items,
  bullets,
}: {
  title: string;
  subtitle?: string;
  content?: string;
  label?: string;
  highlight?: string;
  items?: string[] | { label: string; text: string }[];
  bullets?: string[] | { label: string; text: string }[];
}) {
  const list = items || bullets || [];
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 overflow-y-auto py-14" style={{ background: BG }}>
      <div className="max-w-full">
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.4rem, 5vw, 2rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight whitespace-pre-line"
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ ...fadeStyle(0.18), fontSize: "0.8rem", lineHeight: 1.6, color: "rgba(255,255,255,0.45)" }} className="mt-2">
            {subtitle}
          </p>
        )}
        {highlight && (
          <p style={{ ...fadeStyle(0.2), fontSize: "0.9rem", lineHeight: 1.6, color: BEGRAY }} className="mt-5">
            {highlight}
          </p>
        )}
        {content && (
          <p style={{ ...fadeStyle(0.25), fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }} className="mt-4">
            {content}
          </p>
        )}
        {list.length > 0 && (
          <ul className="mt-6 space-y-3">
            {list.map((item, i) => {
              const isObj = typeof item === "object" && item !== null;
              return (
                <li key={i} style={{ ...fadeStyle(0.2 + i * 0.04), fontSize: "0.8rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }} className="flex items-start gap-3">
                  <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: BEGRAY }} />
                  {isObj ? (
                    <span>
                      <span style={{ color: BEGRAY, fontWeight: 500 }}>{(item as any).label}</span>
                      {" — "}
                      {(item as any).text}
                    </span>
                  ) : (
                    item
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Grid Cards Slide ─── */
export function GridSlide({
  title,
  label,
  subtitle,
  cards,
  items,
  columns = 2,
}: {
  title: string;
  label?: string;
  subtitle?: string;
  cards?: { title: string; description: string; icon?: string }[];
  items?: { title: string; description: string; icon?: string }[];
  columns?: 2 | 3 | 4;
}) {
  const data = cards || items || [];
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-2 whitespace-pre-line"
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ ...fadeStyle(0.18), fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }} className="mb-6">
            {subtitle}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {data.map((card, i) => (
            <div
              key={i}
              style={{ ...fadeStyle(0.2 + i * 0.04), background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}
              className="rounded-lg p-4 transition-all duration-300"
            >
              {card.icon && (
                <span className="mb-2 block" style={{ fontSize: "0.7rem", fontWeight: 500, color: BEGRAY }}>{card.icon}</span>
              )}
              <h3 className="text-white mb-1.5" style={{ fontSize: "0.8rem", fontWeight: 500, lineHeight: 1.3 }}>
                {card.title}
              </h3>
              <p style={{ fontSize: "0.7rem", lineHeight: 1.55, color: "rgba(255,255,255,0.4)" }}>
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Process / Steps Slide ─── */
export function ProcessSlide({
  title,
  label,
  steps,
}: {
  title: string;
  label?: string;
  steps: ({ number: string; title: string; description: string } | { label: string; description: string })[];
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-8 whitespace-pre-line"
        >
          {title}
        </h2>
        <div className="space-y-0">
          {steps.map((step, i) => {
            const num = "number" in step ? step.number : String(i + 1).padStart(2, "0");
            const stepTitle = "title" in step ? step.title : ("label" in step ? step.label : "");
            return (
              <div key={i} style={{ ...fadeStyle(0.2 + i * 0.04), borderTop: `1px solid ${BORDER}` }} className="flex items-start gap-4 py-4">
                <span className="shrink-0" style={{ fontSize: "1.1rem", fontWeight: 500, minWidth: "2rem", color: BEGRAY_DIM }}>
                  {num}
                </span>
                <div>
                  <h3 className="text-white mb-0.5" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    {stepTitle}
                  </h3>
                  <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.4)" }}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Funnel Slide ─── */
export function FunnelSlide({
  title,
  label,
  stages,
}: {
  title: string;
  label?: string;
  stages: { name: string; description: string; percentage: string }[];
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-8 whitespace-pre-line"
        >
          {title}
        </h2>
        <div className="flex flex-col items-center gap-2">
          {stages.map((stage, i) => {
            const widthPercent = 100 - i * (50 / stages.length);
            return (
              <div key={i} style={{ ...fadeStyle(0.2 + i * 0.05), width: `${widthPercent}%`, maxWidth: "100%" }} className="relative">
                <div
                  className="rounded-lg px-4 py-3 flex items-center justify-between"
                  style={{ background: `linear-gradient(90deg, rgba(184,170,154,0.12) 0%, rgba(184,170,154,0.03) 100%)`, border: `1px solid rgba(184,170,154,0.12)` }}
                >
                  <div>
                    <span className="text-white" style={{ fontSize: "0.8rem", fontWeight: 500 }}>{stage.name}</span>
                    <p className="mt-0.5" style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>{stage.description}</p>
                  </div>
                  <span className="shrink-0 ml-3" style={{ fontSize: "0.95rem", fontWeight: 500, color: BEGRAY }}>{stage.percentage}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Two Column Slide ─── */
export function TwoColumnSlide({
  title,
  label,
  leftTitle: leftTitleProp,
  leftItems: leftItemsProp,
  rightTitle: rightTitleProp,
  rightItems: rightItemsProp,
  left,
  right,
  leftColor,
  rightColor,
}: {
  title: string;
  label?: string;
  leftTitle?: string;
  leftItems?: string[];
  rightTitle?: string;
  rightItems?: string[];
  left?: { title: string; items: string[] };
  right?: { title: string; items: string[] };
  leftColor?: string;
  rightColor?: string;
}) {
  const leftTitle = leftTitleProp || left?.title || "";
  const leftItems = leftItemsProp || left?.items || [];
  const rightTitle = rightTitleProp || right?.title || "";
  const rightItems = rightItemsProp || right?.items || [];
  const lColor = leftColor === "#C4956A" ? BEGRAY : (leftColor || BEGRAY);
  const rColor = rightColor === "#E85D5D" ? "#D4716A" : (rightColor || "#888");

  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-8 whitespace-pre-line"
        >
          {title}
        </h2>
        <div className="space-y-6">
          <div style={fadeStyle(0.2)}>
            <h3 className="mb-3 pb-2" style={{ fontSize: "0.85rem", fontWeight: 500, color: lColor, borderBottom: `1px solid ${BORDER}` }}>
              {leftTitle}
            </h3>
            <ul className="space-y-2">
              {leftItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5" style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
                  <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: lColor }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={fadeStyle(0.3)}>
            <h3 className="mb-3 pb-2" style={{ fontSize: "0.85rem", fontWeight: 500, color: rColor, borderBottom: `1px solid ${BORDER}` }}>
              {rightTitle}
            </h3>
            <ul className="space-y-2">
              {rightItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5" style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
                  <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: rColor }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Statement Slide ─── */
export function StatementSlide({
  statement,
  attribution,
  label,
}: {
  statement: string;
  attribution?: string;
  label?: string;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center px-8 sm:px-12" style={{ background: BG }}>
      <div className="max-w-sm text-center">
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.55rem", color: BEGRAY }} className="tracking-[0.35em] uppercase mb-6">
            {label}
          </p>
        )}
        <div style={{ ...fadeStyle(0.15), background: BEGRAY_DIM }} className="mx-auto mb-6 h-px w-6" />
        <blockquote
          style={{ ...fadeStyle(0.2), fontSize: "clamp(1.15rem, 4vw, 1.6rem)", lineHeight: 1.45, fontWeight: 300, letterSpacing: "-0.01em" }}
          className="text-white"
        >
          {statement}
        </blockquote>
        {attribution && (
          <p style={{ ...fadeStyle(0.3), fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }} className="mt-6">
            — {attribution}
          </p>
        )}
        <div style={{ ...fadeStyle(0.35), background: BEGRAY_DIM }} className="mx-auto mt-6 h-px w-6" />
      </div>
    </div>
  );
}

/* ─── Metrics Slide ─── */
export function MetricsSlide({
  title,
  label,
  subtitle,
  metrics,
}: {
  title: string;
  label?: string;
  subtitle?: string;
  metrics: { value: string; label: string; description?: string }[];
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-2 whitespace-pre-line"
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ ...fadeStyle(0.18), fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }} className="mb-8">
            {subtitle}
          </p>
        )}
        {!subtitle && <div className="mb-8" />}
        <div className="grid grid-cols-2 gap-6">
          {metrics.map((metric, i) => (
            <div key={i} style={{ ...fadeStyle(0.2 + i * 0.08), borderTop: `1px solid ${BEGRAY_DIM}` }} className="pt-4">
              <span className="text-white block" style={{ fontSize: "clamp(1.8rem, 7vw, 2.5rem)", fontWeight: 500, lineHeight: 1, letterSpacing: "-0.03em" }}>
                {metric.value}
              </span>
              <span className="block mt-1.5" style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                {metric.label}
              </span>
              {metric.description && (
                <span className="block mt-0.5" style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>
                  {metric.description}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Role Card Slide (vertical: image top, content bottom) ─── */
export function RoleSlide({
  role,
  label,
  mission,
  responsibilities,
  kpis,
  image,
}: {
  role: string;
  label?: string;
  mission: string;
  responsibilities: string[];
  kpis: string[];
  image?: string;
}) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: BG }}>
      {image && (
        <div className="relative w-full" style={{ flex: "0 0 30%" }}>
          <ImageWithFallback src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BG} 0%, transparent 60%)` }} />
        </div>
      )}
      <div className="flex-1 px-8 sm:px-12 py-5 overflow-y-auto">
        {label && (
          <p style={{ ...fadeStyle(0.05), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-3">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.1), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight whitespace-pre-line"
        >
          {role}
        </h2>
        <p style={{ ...fadeStyle(0.15), fontSize: "0.8rem", lineHeight: 1.6, color: BEGRAY }} className="mt-2">
          {mission}
        </p>

        <div style={fadeStyle(0.2)} className="mt-5">
          <h4 className="tracking-[0.25em] uppercase mb-2" style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>
            Responsabilidades
          </h4>
          <ul className="space-y-1.5">
            {responsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5" style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "rgba(255,255,255,0.6)" }}>
                <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: BEGRAY }} />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div style={fadeStyle(0.3)} className="mt-4">
          <h4 className="tracking-[0.25em] uppercase mb-2" style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>
            KPIs
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {kpis.map((kpi, i) => (
              <span
                key={i}
                className="rounded-full px-2.5 py-0.5"
                style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }}
              >
                {kpi}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Closing Slide ─── */
export function ClosingSlide({
  title,
  subtitle,
  image,
  logo,
}: {
  title: string;
  subtitle?: string;
  image: string;
  logo?: string;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: BG }}>
      <div className="absolute inset-0">
        <ImageWithFallback src={image} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BG} 0%, ${BG}cc 40%, ${BG}88 100%)` }} />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8">
        <div style={{ ...fadeStyle(0.1), background: BEGRAY }} className="h-px w-10 mb-10" />
        {logo ? (
          <div style={fadeStyle(0.2)}>
            <img src={logo} alt="Parket" className="h-10 sm:h-14 w-auto object-contain" />
          </div>
        ) : (
          <h1
            style={{ ...fadeStyle(0.2), fontSize: "clamp(2rem, 8vw, 3rem)", lineHeight: 1.1, fontWeight: 500, letterSpacing: "-0.02em" }}
            className="text-white tracking-tight whitespace-pre-line"
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p style={{ ...fadeStyle(0.3), fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(255,255,255,0.4)" }} className="mt-6 max-w-xs whitespace-pre-line">
            {subtitle}
          </p>
        )}
        <div style={{ ...fadeStyle(0.4), background: BEGRAY }} className="h-px w-10 mt-10" />
      </div>
    </div>
  );
}

/* ─── Script / Dialogue Slide ─── */
export function ScriptSlide({
  title,
  label,
  context,
  lines,
  tips,
}: {
  title: string;
  label?: string;
  context?: string;
  lines: { speaker: string; text: string }[];
  tips?: string[];
}) {
  return (
    <div className="w-full h-full flex flex-col justify-start px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.2rem, 4.5vw, 1.6rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight whitespace-pre-line"
        >
          {title}
        </h2>
        {context && (
          <p style={{ ...fadeStyle(0.2), fontSize: "0.75rem", lineHeight: 1.6, color: BEGRAY, fontStyle: "italic" }} className="mt-3 pb-4" >
            {context}
          </p>
        )}
        <div className="mt-4 space-y-2.5">
          {lines.map((line, i) => {
            const isClient = line.speaker.toLowerCase().includes("client") || line.speaker.toLowerCase().includes("arquitet") || line.speaker.toLowerCase().includes("secretár") || line.speaker.toLowerCase().includes("prospect") || line.speaker.toLowerCase().includes("lead");
            return (
              <div key={i} style={{ ...fadeStyle(0.2 + i * 0.03) }} className="flex items-start gap-3">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 mt-0.5"
                  style={{
                    fontSize: "0.55rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    background: isClient ? "rgba(255,255,255,0.06)" : "rgba(184,170,154,0.15)",
                    color: isClient ? "rgba(255,255,255,0.5)" : BEGRAY,
                    minWidth: "3rem",
                    textAlign: "center",
                  }}
                >
                  {line.speaker}
                </span>
                <p style={{ fontSize: "0.75rem", lineHeight: 1.55, color: isClient ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)" }}>
                  "{line.text}"
                </p>
              </div>
            );
          })}
        </div>
        {tips && tips.length > 0 && (
          <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
            <h4 className="tracking-[0.25em] uppercase mb-2" style={{ ...fadeStyle(0.4), fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>
              Dicas
            </h4>
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2" style={{ ...fadeStyle(0.4 + i * 0.03), fontSize: "0.7rem", lineHeight: 1.5, color: BEGRAY }}>
                  <span className="shrink-0 mt-1">→</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Palette Slide ─── */
export function PaletteSlide({
  title,
  label,
  colors,
  note,
}: {
  title: string;
  label?: string;
  colors: { name: string; hex: string; usage: string; isPrimary?: boolean }[];
  note?: string;
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-8 whitespace-pre-line"
        >
          {title}
        </h2>
        <div className="space-y-3">
          {colors.map((color, i) => (
            <div
              key={i}
              style={{ ...fadeStyle(0.2 + i * 0.05) }}
              className="flex items-center gap-4"
            >
              <div
                className="shrink-0 rounded-lg"
                style={{
                  width: color.isPrimary ? "56px" : "44px",
                  height: color.isPrimary ? "56px" : "44px",
                  background: color.hex,
                  border: color.hex.toLowerCase() === "#ffffff" || color.hex.toLowerCase() === "#fff"
                    ? `1px solid ${BORDER}`
                    : "none",
                  boxShadow: `0 2px 12px ${color.hex}33`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-white" style={{ fontSize: "0.85rem", fontWeight: 500 }}>{color.name}</span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{color.hex}</span>
                </div>
                <p style={{ fontSize: "0.7rem", lineHeight: 1.5, color: "rgba(255,255,255,0.4)" }} className="mt-0.5">
                  {color.usage}
                </p>
              </div>
            </div>
          ))}
        </div>
        {note && (
          <p style={{ ...fadeStyle(0.5), fontSize: "0.7rem", lineHeight: 1.6, color: BEGRAY, fontStyle: "italic", borderTop: `1px solid ${BORDER}` }} className="mt-6 pt-4">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Do's and Don'ts Slide ─── */
export function DosDontsSlide({
  title,
  label,
  dos,
  donts,
}: {
  title: string;
  label?: string;
  dos: string[];
  donts: string[];
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-8 whitespace-pre-line"
        >
          {title}
        </h2>
        <div className="space-y-6">
          {/* Do's */}
          <div style={fadeStyle(0.2)}>
            <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "0.9rem", color: "#6ECB8A" }}>&#10003;</span>
              <h3 style={{ fontSize: "0.8rem", fontWeight: 500, color: "#6ECB8A", letterSpacing: "0.15em" }} className="uppercase">
                Faça
              </h3>
            </div>
            <ul className="space-y-2">
              {dos.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5" style={{ ...fadeStyle(0.25 + i * 0.03), fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
                  <span className="shrink-0 mt-1" style={{ color: "#6ECB8A", fontSize: "0.6rem" }}>&#9679;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Don'ts */}
          <div style={fadeStyle(0.35)}>
            <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "0.9rem", color: "#D4716A" }}>&#10007;</span>
              <h3 style={{ fontSize: "0.8rem", fontWeight: 500, color: "#D4716A", letterSpacing: "0.15em" }} className="uppercase">
                Evite
              </h3>
            </div>
            <ul className="space-y-2">
              {donts.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5" style={{ ...fadeStyle(0.4 + i * 0.03), fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
                  <span className="shrink-0 mt-1" style={{ color: "#D4716A", fontSize: "0.6rem" }}>&#9679;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Brand Axis Slide ─── */
export function BrandAxisSlide({
  title,
  label,
  axes,
  note,
}: {
  title: string;
  label?: string;
  axes: { leftLabel: string; rightLabel: string; position: number }[];
  note?: string;
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-10 whitespace-pre-line"
        >
          {title}
        </h2>
        <div className="space-y-7">
          {axes.map((axis, i) => (
            <div key={i} style={fadeStyle(0.2 + i * 0.06)}>
              <div className="flex justify-between mb-2">
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{axis.leftLabel}</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{axis.rightLabel}</span>
              </div>
              <div className="relative h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                  style={{
                    left: `${axis.position}%`,
                    transform: `translate(-50%, -50%)`,
                    background: BEGRAY,
                    boxShadow: `0 0 12px ${BEGRAY}66`,
                  }}
                />
                <div
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: `${axis.position}%`,
                    background: `linear-gradient(90deg, transparent 0%, ${BEGRAY}44 100%)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {note && (
          <p style={{ ...fadeStyle(0.6), fontSize: "0.7rem", lineHeight: 1.6, color: "rgba(255,255,255,0.35)", borderTop: `1px solid ${BORDER}` }} className="mt-8 pt-4">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Persona Slide ─── */
export function PersonaSlide({
  title,
  label,
  name,
  role,
  demographics,
  needs,
  painPoints,
}: {
  title: string;
  label?: string;
  name: string;
  role: string;
  demographics: string;
  needs: string[];
  painPoints: string[];
}) {
  return (
    <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 py-14 overflow-y-auto" style={{ background: BG }}>
      <div>
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-4">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight mb-6 whitespace-pre-line"
        >
          {title}
        </h2>

        {/* Persona header */}
        <div style={{ ...fadeStyle(0.2), background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }} className="rounded-lg p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${BEGRAY}22`, border: `1px solid ${BEGRAY}33` }}>
              <span style={{ fontSize: "1rem", color: BEGRAY }}>{name.charAt(0)}</span>
            </div>
            <div>
              <span className="text-white block" style={{ fontSize: "0.9rem", fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: "0.7rem", color: BEGRAY }}>{role}</span>
            </div>
          </div>
          <p style={{ fontSize: "0.7rem", lineHeight: 1.6, color: "rgba(255,255,255,0.4)" }} className="mt-2">
            {demographics}
          </p>
        </div>

        {/* Needs */}
        <div style={fadeStyle(0.3)} className="mb-4">
          <h4 className="tracking-[0.25em] uppercase mb-2" style={{ fontSize: "0.55rem", color: "#6ECB8A" }}>
            Necessidades
          </h4>
          <ul className="space-y-1.5">
            {needs.map((n, i) => (
              <li key={i} className="flex items-start gap-2" style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "rgba(255,255,255,0.6)" }}>
                <span className="shrink-0 mt-1" style={{ color: "#6ECB8A", fontSize: "0.5rem" }}>&#9679;</span>
                {n}
              </li>
            ))}
          </ul>
        </div>

        {/* Pain points */}
        <div style={fadeStyle(0.4)}>
          <h4 className="tracking-[0.25em] uppercase mb-2" style={{ fontSize: "0.55rem", color: "#D4716A" }}>
            Dores
          </h4>
          <ul className="space-y-1.5">
            {painPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2" style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "rgba(255,255,255,0.6)" }}>
                <span className="shrink-0 mt-1" style={{ color: "#D4716A", fontSize: "0.5rem" }}>&#9679;</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── Visual Guidelines Slide ─── */
export function VisualSlide({
  title,
  label,
  image,
  guidelines,
  caption,
}: {
  title: string;
  label?: string;
  image: string;
  guidelines: string[];
  caption?: string;
}) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: BG }}>
      {/* Image top 45% */}
      <div className="relative w-full" style={{ flex: "0 0 42%" }}>
        <ImageWithFallback src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${BG} 0%, transparent 60%)` }} />
        {caption && (
          <div className="absolute bottom-3 left-8 right-8">
            <span style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY, letterSpacing: "0.1em" }}>{caption}</span>
          </div>
        )}
      </div>
      {/* Content bottom */}
      <div className="flex-1 px-8 sm:px-12 py-5 overflow-y-auto">
        {label && (
          <p style={{ ...fadeStyle(0.1), fontSize: "0.6rem", color: BEGRAY }} className="tracking-[0.3em] uppercase mb-3">
            {label}
          </p>
        )}
        <h2
          style={{ ...fadeStyle(0.15), fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.15, fontWeight: 500, letterSpacing: "-0.02em" }}
          className="text-white tracking-tight whitespace-pre-line"
        >
          {title}
        </h2>
        <ul className="mt-4 space-y-2">
          {guidelines.map((g, i) => (
            <li key={i} style={{ ...fadeStyle(0.2 + i * 0.04), fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.55)" }} className="flex items-start gap-2.5">
              <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: BEGRAY }} />
              {g}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}