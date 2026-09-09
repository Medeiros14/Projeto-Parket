/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE — Escolha entre Parketapp_Sistema e Parketapp_Obras
   ═══════════════════════════════════════════════════════════════ */
import React from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { BarChart3, HardHat, ArrowRight, Shield, Zap, Users, Factory, Eye, Layers } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const BG = "#0A0A0A";
const ACCENT = "#B8AA9A";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT_DIM = "rgba(255,255,255,0.4)";

export function LandingPage() {
  const navigate = useNavigate();

  const systems = [
    {
      id: "sistema",
      title: "Parketapp Sistema",
      subtitle: "Dashboard Operacional & Administrativo",
      desc: "13 departamentos · Kanban · KPIs · Alertas IA · Handoffs · Modal 360° · Ferramentas de produtividade",
      icon: BarChart3,
      color: "#D4A853",
      gradient: "linear-gradient(135deg, rgba(212,168,83,0.15) 0%, rgba(212,168,83,0.03) 100%)",
      borderColor: "rgba(212,168,83,0.25)",
      route: "/sistema",
      image: "https://images.unsplash.com/photo-1561634062-e0b25ff5ce18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBkYXNoYm9hcmQlMjBzY3JlZW58ZW58MXx8fHwxNzcyOTM1NjU3fDA&ixlib=rb-4.1.0&q=80&w=1080",
      features: [
        { icon: Layers, label: "13 Departamentos integrados" },
        { icon: Zap, label: "Alertas IA em tempo real" },
        { icon: Eye, label: "CEO Dashboard & Command Center" },
      ],
    },
    {
      id: "obras",
      title: "Parketapp Obras",
      subtitle: "App de Campo & Produção",
      desc: "Controle de equipes · Check-in · Feed de obras · Produção · Fiscalização · Relatórios em tempo real",
      icon: HardHat,
      color: "#10B981",
      gradient: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.03) 100%)",
      borderColor: "rgba(16,185,129,0.25)",
      route: "/obras",
      image: "https://images.unsplash.com/photo-1766595680977-fd4818afa337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwcHJvZ3Jlc3MlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzI5NDQxNTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
      features: [
        { icon: Users, label: "5 perfis: Instalador, Marceneiro, Fábrica, Fiscal" },
        { icon: Factory, label: "Produção + Campo em tempo real" },
        { icon: Shield, label: "Gamificação & Ranking de equipes" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: ACCENT }}>P</span>
          </div>
          <div>
            <h1 className="text-white" style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.08em" }}>
              PARKET<span style={{ color: ACCENT }}>APP</span>
            </h1>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM, letterSpacing: "0.2em" }}>SISTEMA OPERACIONAL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-3 py-1" style={{ fontSize: "0.55rem", color: TEXT_DIM, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
            v2.0 · Mar 2026
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="tracking-[0.3em] uppercase mb-3" style={{ fontSize: "0.55rem", color: ACCENT }}>
            Selecione o sistema
          </p>
          <h2 className="text-white mb-2" style={{ fontSize: "1.6rem", fontWeight: 300, letterSpacing: "0.02em" }}>
            Bem-vindo ao <strong style={{ fontWeight: 700 }}>Parket</strong>
          </h2>
          <p style={{ fontSize: "0.75rem", color: TEXT_DIM, maxWidth: 500, margin: "0 auto" }}>
            Escolha qual módulo deseja acessar. Cada sistema é independente e otimizado para sua função.
          </p>
        </motion.div>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
          {systems.map((sys, i) => {
            const Icon = sys.icon;
            return (
              <motion.div
                key={sys.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.15 }}
              >
                <button
                  onClick={() => navigate(sys.route)}
                  className="w-full text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group"
                  style={{ background: sys.gradient, border: `1px solid ${sys.borderColor}` }}
                >
                  {/* Image Banner */}
                  <div className="relative h-40 overflow-hidden">
                    <ImageWithFallback
                      src={sys.image}
                      alt={sys.title}
                      className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500"
                    />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,10,10,0.95) 0%, transparent 60%)" }} />
                    <div className="absolute bottom-4 left-5 right-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${sys.color}20`, border: `1px solid ${sys.color}30` }}>
                          <Icon size={22} style={{ color: sys.color }} />
                        </div>
                        <div>
                          <h3 className="text-white" style={{ fontSize: "1.1rem", fontWeight: 700 }}>{sys.title}</h3>
                          <p style={{ fontSize: "0.65rem", color: sys.color, fontWeight: 500 }}>{sys.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <p className="mb-4" style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                      {sys.desc}
                    </p>

                    <div className="space-y-2 mb-5">
                      {sys.features.map((f, fi) => {
                        const FIcon = f.icon;
                        return (
                          <div key={`feat-${sys.id}-${fi}`} className="flex items-center gap-2.5">
                            <FIcon size={12} style={{ color: sys.color }} />
                            <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)" }}>{f.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 group-hover:gap-3 transition-all"
                      style={{ color: sys.color, fontSize: "0.72rem", fontWeight: 600 }}>
                      Acessar <ArrowRight size={14} />
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center" style={{ borderTop: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.5rem", color: TEXT_DIM, letterSpacing: "0.15em" }}>
          PARKET PISOS · SISTEMA OPERACIONAL INTEGRADO · 2026
        </p>
      </footer>
    </div>
  );
}
