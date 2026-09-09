/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade Sistema Operacional Parket — paleta Manual de Marca.
        // Vars em CSS → suporta light/dark via toggle de classe `.light` no <html>.
        pk: {
          bg:         "rgb(var(--pk-bg) / <alpha-value>)",
          panel:      "rgb(var(--pk-panel) / <alpha-value>)",
          panelLight: "rgb(var(--pk-panelLight) / <alpha-value>)",
          border:      "rgb(var(--pk-border) / <alpha-value>)",
          borderHover: "rgb(var(--pk-borderHover) / <alpha-value>)",
          headerBg:    "rgb(var(--pk-headerBg) / <alpha-value>)",
          text:       "rgb(var(--pk-text) / <alpha-value>)",
          textDim:    "rgb(var(--pk-textDim) / <alpha-value>)",
          accent:     "rgb(var(--pk-accent) / <alpha-value>)",
          cream:      "rgb(var(--pk-cream) / <alpha-value>)",
          walnut:     "rgb(var(--pk-walnut) / <alpha-value>)",
          // Paleta brand (cores absolutas — não flipam com tema)
          moss:           "rgb(var(--pk-moss) / <alpha-value>)",
          oat:            "rgb(var(--pk-oat) / <alpha-value>)",
          olive:          "rgb(var(--pk-olive) / <alpha-value>)",
          sand:           "rgb(var(--pk-sand) / <alpha-value>)",
          wood:           "rgb(var(--pk-wood) / <alpha-value>)",
          navy:           "rgb(var(--pk-navy) / <alpha-value>)",
          whiteChocolate: "rgb(var(--pk-whiteChocolate) / <alpha-value>)",
          morningBlue:    "rgb(var(--pk-morningBlue) / <alpha-value>)",
          shadow:         "rgb(var(--pk-shadow) / <alpha-value>)",
          raisinBlack:    "rgb(var(--pk-raisinBlack) / <alpha-value>)",
          // Funcionais em tons SO (positivo/negativo/warning/info)
          green: "rgb(var(--pk-green) / <alpha-value>)",
          red:   "rgb(var(--pk-red) / <alpha-value>)",
          amber: "rgb(var(--pk-amber) / <alpha-value>)",
          blue:  "rgb(var(--pk-blue) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Cinzel", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // SO Parket = cantos retos. Manter rounded-full pra avatares.
      borderRadius: {
        none: "0", sm: "0", DEFAULT: "0", md: "0",
        lg: "2px", xl: "3px", "2xl": "4px", "3xl": "6px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
