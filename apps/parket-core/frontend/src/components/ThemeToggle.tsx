import { useTheme } from "../lib/theme";

/**
 * Botão de tema inline (mesmo padrão gestao.parket.works — sol/lua SVG,
 * borde retangular, sem `id` fixo). Usado dentro do rodapé da sidebar em
 * Layout.tsx; também é o botão da rota pública /contrato/ (App.tsx).
 * Mostra 🌙 quando está dark (clica = vai pra light), ☀️ quando light.
 */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const { theme, toggle } = useTheme();
  const style: React.CSSProperties = floating
    ? {
        position: "fixed", bottom: 14, right: 14, zIndex: 2147483647,
        width: 32, height: 30,
      }
    : { width: 30, height: 26 };
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      className="inline-flex items-center justify-center border border-parket-border text-parket-textDim hover:text-parket-text hover:border-parket-borderHover transition bg-transparent px-0"
      style={style}
    >
      {theme === "dark" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
