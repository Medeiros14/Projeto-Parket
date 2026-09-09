/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade Sistema Operacional Parket — paleta Manual de Marca.
        // Cores resolvidas via CSS vars (vide index.css) pra suportar light/dark
        // sem recompilar. Sintaxe `rgb(var(--xxx) / <alpha-value>)` preserva o
        // alpha helper do Tailwind (`bg-hb-bg/15`, etc.).
        hb: {
          bg:          "rgb(var(--hb-bg) / <alpha-value>)",
          sidebar:     "rgb(var(--hb-sidebar) / <alpha-value>)",
          header:      "rgb(var(--hb-header) / <alpha-value>)",
          panel:       "rgb(var(--hb-panel) / <alpha-value>)",
          panelLight:  "rgb(var(--hb-panelLight) / <alpha-value>)",
          border:      "rgb(var(--hb-border) / <alpha-value>)",
          borderHover: "rgb(var(--hb-borderHover) / <alpha-value>)",
          inputBg:     "rgb(var(--hb-inputBg) / <alpha-value>)",
          statBg:      "rgb(var(--hb-statBg) / <alpha-value>)",
          text:        "rgb(var(--hb-text) / <alpha-value>)",
          textDim:     "rgb(var(--hb-textDim) / <alpha-value>)",
          textMuted:   "rgb(var(--hb-textMuted) / <alpha-value>)",
          accent:      "rgb(var(--hb-accent) / <alpha-value>)",
          cream:      "rgb(var(--hb-cream) / <alpha-value>)",
          walnut:     "rgb(var(--hb-walnut) / <alpha-value>)",
          gold:       "rgb(var(--hb-gold) / <alpha-value>)",
          green:      "rgb(var(--hb-green) / <alpha-value>)",
          red:        "rgb(var(--hb-red) / <alpha-value>)",
          amber:      "rgb(var(--hb-amber) / <alpha-value>)",
          blue:       "rgb(var(--hb-blue) / <alpha-value>)",

          // Paleta acentos brand — pra variar cores em KPIs, gráficos, sparklines
          moss:           "rgb(var(--hb-moss) / <alpha-value>)",
          oat:            "rgb(var(--hb-oat) / <alpha-value>)",
          olive:          "rgb(var(--hb-olive) / <alpha-value>)",
          sand:           "rgb(var(--hb-sand) / <alpha-value>)",
          wood:           "rgb(var(--hb-wood) / <alpha-value>)",
          navy:           "rgb(var(--hb-navy) / <alpha-value>)",
          whiteChocolate: "rgb(var(--hb-whiteChocolate) / <alpha-value>)",
          morningBlue:    "rgb(var(--hb-morningBlue) / <alpha-value>)",
          shadow:         "rgb(var(--hb-shadow) / <alpha-value>)",
          raisinBlack:    "rgb(var(--hb-raisinBlack) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Cinzel", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // SO Parket = cantos retos. Manter rounded-full pra avatares/pulses.
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "2px",
        xl: "3px",
        "2xl": "4px",
        "3xl": "6px",
        full: "9999px",
      },
      keyframes: {
        ticker: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        pulseUp:   { "0%,100%": { background: "rgba(16,185,129,0)" }, "50%": { background: "rgba(16,185,129,0.18)" } },
        pulseDown: { "0%,100%": { background: "rgba(239,68,68,0)" },  "50%": { background: "rgba(239,68,68,0.18)" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
      },
      animation: {
        ticker: "ticker 40s linear infinite",
        "pulse-up":   "pulseUp 1.2s ease-in-out 2",
        "pulse-down": "pulseDown 1.2s ease-in-out 2",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
