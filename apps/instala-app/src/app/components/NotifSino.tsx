// NotifSino.tsx - sino de notificacoes do instalador (Will 08/09: "avisar
// quando chega coisa nova no app, obra nova, tudo").
//
// O QUE: busca o feed derivado GET /api/app/notificacoes?prestador_id= no
// gestao API (obra nova, veredito do fiscal, material respondido, ocorrencia
// resolvida, custo aprovado/pago) e mostra um badge com a contagem do que
// chegou depois da ultima vez que o instalador abriu o painel.
//
// COMO: sem estado no servidor; a "ultima leitura" fica no localStorage por
// prestador. Poll a cada 90s + refetch ao abrir. O painel e um visor de tela
// cheia dentro do app (app de campo nunca abre aba nova). Clicar num item
// navega pro destino indicado pelo backend (campo tail).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, ChevronRight } from "lucide-react";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../lib/auth";
import { GESTAO_API } from "../../lib/offline";

type Notif = { id: string; tipo: string; titulo: string; texto: string; data: string; tail: string };

const POLL_MS = 90_000; // 90s: novidade nao e chat, nao precisa ser instantaneo

// Chave do localStorage por prestador (dois logins no mesmo aparelho nao se misturam)
const seenKey = (pid: string) => `parket-instala-notif-seen:${pid}`;

// "2026-09-08T14:27:08+00:00" -> "08/09 11:27" no fuso do aparelho
function fmtQuando(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function NotifSino({ slug }: { slug: string }) {
  const { T } = useTheme();
  const nav = useNavigate();
  const { prestador } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [aberto, setAberto] = useState(false);
  // lastSeen em state pra re-renderizar o badge na hora que o painel abre
  const [lastSeen, setLastSeen] = useState<string>(() =>
    prestador ? localStorage.getItem(seenKey(prestador.id)) || "" : "");
  const timer = useRef<number | null>(null);

  const buscar = useCallback(async () => {
    if (!prestador) return;
    try {
      const r = await fetch(`${GESTAO_API}/api/app/notificacoes?prestador_id=${prestador.id}`);
      if (!r.ok) return; // feed e conveniencia: erro silencioso, tenta no proximo poll
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch { /* offline: fila do app ja avisa; o sino so fica sem badge */ }
  }, [prestador]);

  // Poll: busca ao montar e a cada 90s enquanto a tela esta aberta
  useEffect(() => {
    buscar();
    timer.current = window.setInterval(buscar, POLL_MS);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [buscar]);

  if (!prestador) return null;

  const naoLidas = items.filter((i) => !lastSeen || i.data > lastSeen).length;

  // Abrir o painel = marcar tudo como visto (o corte e o instante de abertura)
  const abrir = () => {
    setAberto(true);
    buscar();
  };
  const fechar = () => {
    const agora = new Date().toISOString();
    localStorage.setItem(seenKey(prestador.id), agora);
    setLastSeen(agora);
    setAberto(false);
  };

  // tail "obra/<card_id>" e rota SEM slug (/obra/:cardId); o resto e /<slug>/<tail>
  const irPara = (n: Notif) => {
    fechar();
    if (n.tail.startsWith("obra/")) nav(`/${n.tail}`);
    else nav(`/${slug}/${n.tail}`);
  };

  return (
    <>
      <button onClick={abrir} aria-label="Notificações" style={{
        position: "relative", background: T.statBg, border: `1px solid ${T.border}`,
        color: T.textPrimary, padding: 9, cursor: "pointer", borderRadius: 999,
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bell size={16} />
        {naoLidas > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 16, height: 16,
            padding: "0 4px", borderRadius: 999, background: "#C0392B", color: "#fff",
            fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center",
            justifyContent: "center", lineHeight: 1,
          }}>
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        // Visor de tela cheia dentro do app (nunca aba nova em app de campo)
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, background: T.bg,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "18px 22px", borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: T.headerBg, flexShrink: 0,
          }}>
            <div>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted, marginBottom: 4 }}>NOVIDADES</p>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary }}>Notificações</h2>
            </div>
            <button onClick={fechar} aria-label="Fechar" style={{
              background: T.statBg, border: `1px solid ${T.border}`, color: T.textPrimary,
              padding: 9, cursor: "pointer", borderRadius: 999,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px 40px" }}>
            {items.length === 0 && (
              <p style={{ fontSize: 13, color: T.textMuted, textAlign: "center", marginTop: 40 }}>
                Nenhuma novidade por enquanto.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((n) => {
                const nova = !lastSeen || n.data > lastSeen;
                return (
                  <button key={n.id} onClick={() => irPara(n)} style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                    padding: "14px 14px", cursor: "pointer",
                    background: T.cardBg, border: `1px solid ${T.border}`, color: T.textPrimary,
                  }}>
                    {/* Bolinha: item que chegou depois da ultima leitura */}
                    <span style={{
                      width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                      background: nova ? "#C0392B" : T.border,
                    }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: nova ? 600 : 400, marginBottom: 2 }}>
                        {n.titulo}
                      </span>
                      {n.texto && (
                        <span style={{ display: "block", fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                          {n.texto}
                        </span>
                      )}
                      <span style={{ display: "block", fontSize: 9.5, color: T.textMuted, marginTop: 4 }}>
                        {fmtQuando(n.data)}
                      </span>
                    </span>
                    <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
