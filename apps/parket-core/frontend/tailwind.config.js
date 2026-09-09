/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens 1:1 com gestao.parket.works (SO Parket / theme.tsx).
        // Cada token é uma CSS var — troca dark/light acontece no index.css.
        parket: {
          accent:      "var(--parket-accent)",      // Chai (mesmo nos 2 temas)
          accentDark:  "var(--parket-accentDark)",  // Walnut
          bg:          "var(--parket-bg)",
          sidebar:     "var(--parket-sidebar)",
          panel:       "var(--parket-panel)",
          panelLight:  "var(--parket-panelLight)",
          border:      "var(--parket-border)",
          borderHover: "var(--parket-borderHover)",
          text:        "var(--parket-text)",
          textDim:     "var(--parket-textDim)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
