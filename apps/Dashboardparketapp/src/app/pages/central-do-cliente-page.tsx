/* ═══════════════════════════════════════════════════════════════
   CENTRAL DO CLIENTE — Lista de clientes com status cross-dept
   Fonte: golden central-do-cliente-page-Rz6HSqEn.js
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Loader2 as LoaderCircle,
  MapPin,
  Calendar,
  User,
  CheckCircle2,
  CircleX,
  TriangleAlert,
  Clock,
} from "lucide-react";

/* ─── Color tokens ─── */
const BG = "#0A0A0A";
const CARD_BG = "rgba(255,255,255,0.02)";
const BORDER = "rgba(255,255,255,0.06)";
const GOLD = "#D4A853";
const GREEN = "#10B981";
const BLUE = "#3B82F6";
const DIM = "rgba(255,255,255,0.35)";
const DIM2 = "rgba(255,255,255,0.6)";

/* ─── Dept label map ─── */
const DEPT_LABELS: Record<string, string> = {
  comercial: "Comercial",
  orcamento: "Orçamento",
  projetos: "Projetos",
  compras: "Compras",
  producao: "Produção",
  logistica: "Logística",
  obras: "Obras",
  financeiro: "Financeiro",
  fiscal: "Fiscal",
  atendimento: "Atendimento",
  pmo: "PMO",
  rh: "RH",
};

/* ─── Status badge resolver ─── */
function resolveStatus(_deptId: string, columnId: string) {
  if (
    columnId === "ganho" ||
    columnId === "concluido" ||
    columnId === "concluida" ||
    columnId === "entregue" ||
    columnId === "pago"
  ) {
    return {
      label: "Concluído",
      color: GREEN,
      bg: "rgba(16,185,129,0.1)",
      icon: <CheckCircle2 size={11} />,
    };
  }
  if (
    columnId === "perda" ||
    columnId === "cancelado" ||
    columnId === "reprovado"
  ) {
    return {
      label: "Cancelado",
      color: "#EF4444",
      bg: "rgba(239,68,68,0.1)",
      icon: <CircleX size={11} />,
    };
  }
  if (
    columnId === "bloqueado" ||
    columnId === "aguardando" ||
    columnId === "pendente"
  ) {
    return {
      label: "Pendente",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.1)",
      icon: <TriangleAlert size={11} />,
    };
  }
  return {
    label: "Em andamento",
    color: BLUE,
    bg: "rgba(59,130,246,0.1)",
    icon: <Clock size={11} />,
  };
}

/* ─── Types ─── */
interface KanbanCard {
  id: string;
  title: string;
  obra: string | null;
  dept_id: string;
  column_id: string;
  responsavel: string | null;
  created_at: string;
  details: Record<string, any> | null;
}

/* ═══════════════════════════════════════════════════════════════ */
export function CentralClientesPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState<KanbanCard[]>([]);
  const [handoffs, setHandoffs] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ─── Fetch ─── */
  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: raw } = await supabase
      .from("kanban_cards")
      .select(
        "id, title, obra, dept_id, column_id, responsavel, created_at, details"
      )
      .eq("dept_id", "comercial")
      .order("created_at", { ascending: false });

    const rows = raw ?? [];

    // De-duplicate by obra/title
    const seen = new Set<string>();
    const unique: KanbanCard[] = [];
    for (const r of rows) {
      const key = (r.obra || r.title || r.id).trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r as KanbanCard);
      }
    }
    setClients(unique);

    // Fetch cross-dept handoffs for matched obras
    const obraNames = unique.map((c) => c.obra).filter(Boolean) as string[];
    if (obraNames.length) {
      const { data: hData } = await supabase
        .from("kanban_cards")
        .select(
          "id, title, obra, dept_id, column_id, responsavel, created_at, details"
        )
        .in("obra", obraNames)
        .neq("dept_id", "comercial");
      setHandoffs((hData ?? []) as KanbanCard[]);
    }

    setLoading(false);
  }, []);

  /* ─── Initial load ─── */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Realtime subscription ─── */
  useEffect(() => {
    const channel = supabase
      .channel("central-clientes-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kanban_cards" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  /* ─── Filter ─── */
  const filtered = clients.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      ((r.details as any)?.cidade ?? "").toLowerCase().includes(q) ||
      (r.responsavel ?? "").toLowerCase().includes(q)
    );
  });

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: BG, padding: 0 }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: DIM,
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.65rem",
            }}
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div style={{ width: 1, height: 16, background: BORDER }} />
          <p
            style={{
              fontSize: "0.5rem",
              color: DIM,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            Central do Cliente
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingBottom: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              Central do Cliente
            </h1>
            <p style={{ fontSize: "0.65rem", color: DIM, marginTop: 2 }}>
              {clients.length} cliente{clients.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: DIM,
                }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, cidade, vendedor..."
                style={{
                  paddingLeft: 32,
                  paddingRight: 12,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${BORDER}`,
                  color: "#fff",
                  fontSize: "0.65rem",
                  outline: "none",
                  width: 260,
                }}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={fetchData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "7px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                color: DIM2,
                cursor: "pointer",
                fontSize: "0.6rem",
              }}
            >
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 28px" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 0",
              gap: 10,
            }}
          >
            <LoaderCircle
              size={18}
              className="animate-spin"
              style={{ color: GOLD }}
            />
            <span style={{ fontSize: "0.65rem", color: DIM }}>
              Carregando clientes...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: "0.7rem", color: DIM }}>
              {search
                ? "Nenhum cliente encontrado para a busca."
                : "Nenhum cliente cadastrado ainda."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((r) => {
              const details = r.details ?? {};
              const cardHandoffs = handoffs.filter(
                (h) => h.obra && h.obra === r.obra
              );
              const hasDrive = !!(details as any).drive_folder_id;

              return (
                <div
                  key={r.id}
                  onClick={() => navigate(`/central-do-cliente/${r.id}`)}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(212,168,83,0.3)";
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = BORDER;
                    e.currentTarget.style.background = CARD_BG;
                  }}
                >
                  {/* Title row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#fff",
                          lineHeight: 1.3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.title}
                      </p>
                    </div>
                    {hasDrive && (
                      <span
                        style={{
                          fontSize: "0.45rem",
                          fontWeight: 700,
                          padding: "3px 7px",
                          borderRadius: 4,
                          background: "rgba(66,133,244,0.12)",
                          color: "#4285F4",
                          border: "1px solid rgba(66,133,244,0.2)",
                          flexShrink: 0,
                        }}
                      >
                        Drive
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    {(details as any).cidade && (
                      <span
                        style={{
                          fontSize: "0.55rem",
                          color: DIM,
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <MapPin size={10} />
                        {(details as any).cidade}
                      </span>
                    )}
                    {r.responsavel && (
                      <span
                        style={{
                          fontSize: "0.55rem",
                          color: DIM,
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <User size={10} />
                        {r.responsavel}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "0.55rem",
                        color: DIM,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Calendar size={10} />
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  {/* Dept badges */}
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
                  >
                    <span
                      style={{
                        fontSize: "0.45rem",
                        fontWeight: 600,
                        padding: "3px 7px",
                        borderRadius: 4,
                        background: "rgba(16,185,129,0.1)",
                        color: GREEN,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <CheckCircle2 size={9} /> Comercial
                    </span>

                    {cardHandoffs.length === 0 && r.obra ? (
                      <span
                        style={{
                          fontSize: "0.45rem",
                          color: DIM,
                          padding: "3px 7px",
                        }}
                      >
                        Sem handoffs registrados
                      </span>
                    ) : (
                      cardHandoffs.map((h) => {
                        const st = resolveStatus(h.dept_id, h.column_id);
                        return (
                          <span
                            key={h.id}
                            style={{
                              fontSize: "0.45rem",
                              fontWeight: 600,
                              padding: "3px 7px",
                              borderRadius: 4,
                              background: st.bg,
                              color: st.color,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            {st.icon} {DEPT_LABELS[h.dept_id] ?? h.dept_id}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
