/* ═══════════════════════════════════════════════════════════════
   PARKETAPP OBRAS — App de Campo & Produção (Mobile-first)
   Seletor de Perfil → Dashboard → Telas específicas por perfil
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Home, MapPin, Camera, ClipboardList, User, Bell, ArrowLeft,
  CheckCircle2, Clock, AlertTriangle, Star, Trophy, ChevronRight,
  Send, Plus, Filter, Calendar, BarChart3, Eye, Factory, Package,
  Image, MapPinned, FileText, Shield, Zap, TrendingUp, ChevronDown,
  Check, X, Smartphone, Play, Pause, MessageSquare, ThumbsUp, ThumbsDown,
  Users, HardHat, Wrench, Gauge,
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import {
  C, CampoProfile, CAMPO_PROFILES, CAMPO_USERS, OBRAS_CAMPO,
  CHECKINS, POSTS_CAMPO, TAREFAS_CAMPO, ORDENS_PRODUCAO,
  RANKING, NOTIFICACOES, getGreeting,
  type CampoUser, type PostCampo, type TarefaCampo, type OrdemProducao,
  type NotifCampo, type ObraCampo,
} from "../components/campo/campo-data";
import { useCampo } from "../hooks/useCampo";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

/* ─── Layout Shell ─── */
function MobileShell({ children, title, onBack, rightAction, accent = C.accent }: {
  children: React.ReactNode; title: string; onBack?: () => void;
  rightAction?: React.ReactNode; accent?: string;
}) {
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: C.bgDark }}>
      <div className="w-full max-w-[430px] min-h-screen relative" style={{ background: C.bg }}>
        {/* Status bar */}
        <div className="h-6 flex items-center justify-between px-4" style={{ background: "white" }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 600, color: C.text }}>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 rounded-sm" style={{ background: C.text }} />
          </div>
        </div>
        {/* Header */}
        <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: "white", borderBottom: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#F3F4F6" }}>
              <ArrowLeft size={16} style={{ color: C.text }} />
            </button>
          )}
          <h1 className="flex-1" style={{ fontSize: "0.9rem", fontWeight: 700, color: C.text }}>{title}</h1>
          {rightAction}
        </header>
        {/* Content */}
        <div className="pb-20">
          {children}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ items, active, onSelect }: {
  items: { id: string; icon: React.ElementType; label: string }[];
  active: string; onSelect: (id: string) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 flex items-center justify-around py-2 pb-3"
      style={{ background: "white", borderTop: `1px solid ${C.border}`, boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button key={item.id} onClick={() => onSelect(item.id)} className="flex flex-col items-center gap-0.5 px-3 py-1 transition-all">
            <Icon size={20} style={{ color: isActive ? C.accent : C.textDim }} strokeWidth={isActive ? 2.5 : 1.8} />
            <span style={{ fontSize: "0.5rem", fontWeight: isActive ? 700 : 400, color: isActive ? C.accent : C.textDim }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ─── Shared Components ─── */
function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    pendente: { bg: "#FEF3C7", color: "#D97706", label: "Pendente" },
    aprovado: { bg: "#D1FAE5", color: "#059669", label: "Aprovado" },
    rejeitado: { bg: "#FEE2E2", color: "#DC2626", label: "Rejeitado" },
    andamento: { bg: "#DBEAFE", color: "#2563EB", label: "Em andamento" },
    concluida: { bg: "#D1FAE5", color: "#059669", label: "Concluída" },
    atrasada: { bg: "#FEE2E2", color: "#DC2626", label: "Atrasada" },
    alta: { bg: "#FEE2E2", color: "#DC2626", label: "Alta" },
    media: { bg: "#FEF3C7", color: "#D97706", label: "Média" },
    baixa: { bg: "#D1FAE5", color: "#059669", label: "Baixa" },
    fila: { bg: "#F3F4F6", color: "#6B7280", label: "Fila" },
    cortando: { bg: "#DBEAFE", color: "#2563EB", label: "Cortando" },
    montando: { bg: "#FEF3C7", color: "#D97706", label: "Montando" },
    acabamento: { bg: "#E0E7FF", color: "#4F46E5", label: "Acabamento" },
    pronto: { bg: "#D1FAE5", color: "#059669", label: "Pronto" },
    entregue: { bg: "#D1FAE5", color: "#059669", label: "Entregue" },
  };
  const c = config[status] || { bg: "#F3F4F6", color: "#6B7280", label: status };
  const px = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";
  const fs = size === "sm" ? "0.55rem" : "0.65rem";
  return (
    <span className={`rounded-full ${px}`} style={{ fontSize: fs, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function QualityStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={`star-${s}`} size={12} fill={s <= rating ? "#F59E0B" : "none"} style={{ color: s <= rating ? "#F59E0B" : "#D1D5DB" }} />
      ))}
    </div>
  );
}

function PostCard({ post, showValidation, onApprove, onReject }: { post: PostCampo; showValidation?: boolean; onApprove?: () => void; onReject?: () => void }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "white", border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Author */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${C.accent}20`, fontSize: "0.6rem", fontWeight: 700, color: C.accent }}>
          {post.userAvatar}
        </div>
        <div className="flex-1">
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: C.text }}>{post.userName}</p>
          <p style={{ fontSize: "0.55rem", color: C.textSec }}>{post.obraNome} · {post.etapa}</p>
        </div>
        <StatusBadge status={post.status} />
      </div>
      {/* Image */}
      <div className="relative" style={{ height: 200 }}>
        <ImageWithFallback src={post.foto} alt={post.descricao} className="w-full h-full object-cover" />
      </div>
      {/* Content */}
      <div className="px-4 py-3">
        <p style={{ fontSize: "0.72rem", color: C.text, lineHeight: 1.5 }}>{post.descricao}</p>
        <div className="flex items-center justify-between mt-2">
          <span style={{ fontSize: "0.55rem", color: C.textDim }}>{post.data} · {post.hora}</span>
          {post.notaQualidade && <QualityStars rating={post.notaQualidade} />}
        </div>
        {post.comentarioFiscal && (
          <div className="mt-2 p-2 rounded-lg" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <p style={{ fontSize: "0.6rem", color: "#166534" }}>
              <strong>Fiscal:</strong> {post.comentarioFiscal}
            </p>
          </div>
        )}
      </div>
      {/* Validation buttons */}
      {showValidation && post.status === "pendente" && (
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={onApprove} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-all active:scale-95"
            style={{ background: "#D1FAE5", color: "#059669", fontSize: "0.75rem", fontWeight: 600 }}>
            <ThumbsUp size={16} /> Aprovar
          </button>
          <button onClick={onReject} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-all active:scale-95"
            style={{ background: "#FEE2E2", color: "#DC2626", fontSize: "0.75rem", fontWeight: 600 }}>
            <ThumbsDown size={16} /> Rejeitar
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: TarefaCampo }) {
  const isLate = task.status === "atrasada" || (task.status === "pendente" && task.prazo <= "08/03");
  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: "white", border: `1px solid ${isLate ? "#FECACA" : C.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{task.titulo}</p>
        <StatusBadge status={task.prioridade} />
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: "0.6rem", color: C.accent, fontWeight: 500 }}>{task.obraNome}</span>
        <span style={{ fontSize: "0.55rem", color: C.textDim }}>· {task.etapa}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar size={11} style={{ color: isLate ? C.red : C.textDim }} />
          <span style={{ fontSize: "0.6rem", color: isLate ? C.red : C.textSec, fontWeight: isLate ? 600 : 400 }}>
            Prazo: {task.prazo}
          </span>
        </div>
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

function OPCard({ op }: { op: OrdemProducao }) {
  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: "white", border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: C.accent }}>{op.codigo}</span>
        <StatusBadge status={op.status} />
      </div>
      <p style={{ fontSize: "0.78rem", fontWeight: 600, color: C.text, marginBottom: 4 }}>{op.item}</p>
      <p style={{ fontSize: "0.6rem", color: C.textSec, marginBottom: 8 }}>{op.material} · Destino: {op.obraNome}</p>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-2 rounded-full" style={{ background: "#F3F4F6" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${op.conclusao}%`, background: op.conclusao === 100 ? C.green : op.conclusao > 50 ? C.accent : C.blue }} />
        </div>
        <span style={{ fontSize: "0.6rem", fontWeight: 600, color: C.text }}>{op.conclusao}%</span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.55rem", color: C.textDim }}>{op.responsavel}</span>
        <span style={{ fontSize: "0.55rem", color: C.textDim }}>Prazo: {op.prazo}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE SELECTOR
   ═══════════════════════════════════════════════════════════════ */
function ProfileSelector({ onSelect }: { onSelect: (p: CampoProfile) => void }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-start justify-center" style={{ background: C.bgDark }}>
      <div className="w-full max-w-[430px] min-h-screen" style={{ background: C.bg }}>
        {/* Header */}
        <div className="px-5 pt-8 pb-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 mb-6" style={{ fontSize: "0.65rem", color: C.textSec }}>
            <ArrowLeft size={14} /> Voltar ao Hub
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${C.accent}15` }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: C.accent }}>P</span>
            </div>
            <div>
              <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text }}>
                Parketapp <span style={{ color: C.green }}>Obras</span>
              </h1>
              <p style={{ fontSize: "0.55rem", color: C.textSec }}>Campo & Produção</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: C.text, marginBottom: 4 }}>Entrar como:</p>
          <p style={{ fontSize: "0.65rem", color: C.textSec }}>Selecione seu perfil para visualizar o app</p>
        </div>

        {/* Profile cards */}
        <div className="px-5 pb-8 space-y-3">
          {CAMPO_PROFILES.map((p, i) => {
            const user = CAMPO_USERS[p.id];
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                onClick={() => onSelect(p.id)}
                className="w-full rounded-2xl overflow-hidden text-left transition-all active:scale-[0.98] hover:shadow-lg group"
                style={{ background: "white", border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar with image */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative">
                    <ImageWithFallback src={p.foto} alt={p.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
                      <span style={{ fontSize: "1.3rem" }}>{p.icon}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text }}>{p.label}</p>
                    <p style={{ fontSize: "0.6rem", color: C.textSec, lineHeight: 1.4, marginTop: 2 }}>{p.desc}</p>
                    {user && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${p.color}20`, fontSize: "0.4rem", fontWeight: 700, color: p.color }}>
                          {user.avatar}
                        </div>
                        <span style={{ fontSize: "0.55rem", color: C.textDim }}>{user.nome}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: C.textDim }} className="group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${p.color}40, ${p.color}10)` }} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — Worker (Instalador / Marceneiro)
   ═══════════════════════════════════════════════════════════════ */
function WorkerDashboard({ user, profile }: { user: CampoUser; profile: CampoProfile }) {
  const obra = OBRAS_CAMPO.find(o => o.id === user.obraAtual);
  const myTasks = TAREFAS_CAMPO.filter(t => t.userId === user.id);
  const pendingTasks = myTasks.filter(t => t.status !== "concluida").length;
  const myPosts = POSTS_CAMPO.filter(p => p.userId === user.id);
  const lastCheckin = CHECKINS.filter(c => c.userId === user.id).sort((a, b) => b.id.localeCompare(a.id))[0];
  const isCheckedIn = lastCheckin && lastCheckin.data === "08/03/2026" && !lastCheckin.horaSaida;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4"
        style={{ background: `linear-gradient(135deg, ${C.accent}15, ${C.accent}05)`, border: `1px solid ${C.accent}20` }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${C.accent}25`, fontSize: "0.8rem", fontWeight: 700, color: C.accent }}>
            {user.avatar}
          </div>
          <div>
            <p style={{ fontSize: "0.9rem", fontWeight: 600, color: C.text }}>{getGreeting()}, {user.nome.split(" ")[0]}!</p>
            <p style={{ fontSize: "0.6rem", color: C.textSec }}>{user.cargo}</p>
          </div>
        </div>
      </motion.div>

      {/* Check-in Status */}
      <div className="rounded-2xl p-4" style={{ background: isCheckedIn ? "#F0FDF4" : "#FFF7ED", border: `1px solid ${isCheckedIn ? "#BBF7D0" : "#FED7AA"}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCheckedIn ? <CheckCircle2 size={18} style={{ color: C.green }} /> : <Clock size={18} style={{ color: C.yellow }} />}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: C.text }}>{isCheckedIn ? "Check-in ativo" : "Sem check-in hoje"}</p>
              <p style={{ fontSize: "0.55rem", color: C.textSec }}>{isCheckedIn ? `Desde ${lastCheckin?.horaEntrada}` : "Faça check-in ao chegar"}</p>
            </div>
          </div>
          {isCheckedIn && (
            <span className="font-mono" style={{ fontSize: "0.85rem", fontWeight: 600, color: C.green }}>
              {lastCheckin?.horaEntrada}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pontos", value: user.pontos, icon: Trophy, color: C.yellow },
          { label: "Tarefas", value: pendingTasks, icon: ClipboardList, color: C.blue },
          { label: "Posts", value: myPosts.length, icon: Camera, color: C.accent },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "white", border: `1px solid ${C.border}` }}>
              <Icon size={16} style={{ color: s.color, margin: "0 auto 4px" }} />
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, display: "block" }}>{s.value}</span>
              <span style={{ fontSize: "0.5rem", color: C.textDim }}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Obra Atual */}
      {obra && (
        <div className="rounded-2xl p-4" style={{ background: "white", border: `1px solid ${C.border}` }}>
          <p className="uppercase tracking-widest mb-2" style={{ fontSize: "0.45rem", color: C.accent, fontWeight: 600 }}>Obra Atual</p>
          <p style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text }}>{obra.nome}</p>
          <p style={{ fontSize: "0.6rem", color: C.textSec, marginBottom: 8 }}>{obra.endereco}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full" style={{ background: "#F3F4F6" }}>
              <div className="h-full rounded-full" style={{ width: `${obra.progresso}%`, background: obra.progresso > 70 ? C.green : C.accent }} />
            </div>
            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: C.text }}>{obra.progresso}%</span>
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {myTasks.filter(t => t.status !== "concluida").length > 0 && (
        <div>
          <p className="uppercase tracking-widest mb-2 px-1" style={{ fontSize: "0.45rem", color: C.textDim, fontWeight: 600 }}>Tarefas Pendentes</p>
          {myTasks.filter(t => t.status !== "concluida").slice(0, 3).map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {/* Last Post */}
      {myPosts.length > 0 && (
        <div>
          <p className="uppercase tracking-widest mb-2 px-1" style={{ fontSize: "0.45rem", color: C.textDim, fontWeight: 600 }}>Último Registro</p>
          <PostCard post={myPosts[0]} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHECK-IN SCREEN
   ═══════════════════════════════════════════════════════════════ */
function CheckinScreen({ user }: { user: CampoUser }) {
  const [checkedIn, setCheckedIn] = useState(true);
  const obra = OBRAS_CAMPO.find(o => o.id === user.obraAtual);
  const recentCheckins = CHECKINS.filter(c => c.userId === user.id).slice(0, 3);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Map placeholder */}
      <div className="rounded-2xl overflow-hidden relative" style={{ height: 200, background: "#E5E7EB", border: `1px solid ${C.border}` }}>
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-2" style={{ background: "rgba(0,0,0,0.04)" }}>
          <MapPinned size={32} style={{ color: C.accent }} />
          <p style={{ fontSize: "0.7rem", color: C.textSec }}>Localização GPS ativa</p>
          {obra && <p style={{ fontSize: "0.55rem", color: C.green, fontWeight: 600 }}>Dentro do raio — {obra.nome}</p>}
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={10} style={{ color: C.textDim }} />
            <span style={{ fontSize: "0.5rem", color: C.textDim }}>-23.5505, -46.6333</span>
          </div>
        </div>
      </div>

      {/* Check-in/out button */}
      <div className="text-center py-4">
        <p className="font-mono mb-4" style={{ fontSize: "2rem", fontWeight: 300, color: C.text }}>
          {new Date().getHours().toString().padStart(2, "0")}:{new Date().getMinutes().toString().padStart(2, "0")}
        </p>
        <button
          onClick={() => setCheckedIn(!checkedIn)}
          className="w-32 h-32 rounded-full mx-auto flex items-center justify-center transition-all active:scale-95 shadow-lg"
          style={{
            background: checkedIn ? `linear-gradient(135deg, ${C.red}, #B91C1C)` : `linear-gradient(135deg, ${C.green}, #059669)`,
            boxShadow: checkedIn ? "0 8px 30px rgba(239,68,68,0.3)" : "0 8px 30px rgba(16,185,129,0.3)",
          }}
        >
          <div className="text-center">
            {checkedIn ? <Pause size={28} className="text-white mx-auto mb-1" /> : <Play size={28} className="text-white mx-auto mb-1" />}
            <span className="text-white block" style={{ fontSize: "0.7rem", fontWeight: 600 }}>
              {checkedIn ? "CHECK-OUT" : "CHECK-IN"}
            </span>
          </div>
        </button>
        <p className="mt-3" style={{ fontSize: "0.6rem", color: C.textSec }}>
          {checkedIn ? "Toque para encerrar o expediente" : "Toque para iniciar o expediente"}
        </p>
      </div>

      {/* Recent */}
      <div className="rounded-2xl p-4" style={{ background: "white", border: `1px solid ${C.border}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: C.text, marginBottom: 12 }}>Últimos Check-ins</p>
        {recentCheckins.map(ck => (
          <div key={ck.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: ck.dentroDoRaio ? C.green : C.red }} />
              <span style={{ fontSize: "0.65rem", color: C.text }}>{ck.data}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono" style={{ fontSize: "0.65rem", color: C.green }}>{ck.horaEntrada}</span>
              {ck.horaSaida && (
                <>
                  <span style={{ fontSize: "0.55rem", color: C.textDim }}>→</span>
                  <span className="font-mono" style={{ fontSize: "0.65rem", color: C.red }}>{ck.horaSaida}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEED SCREEN
   ═══════════════════════════════════════════════════════════════ */
function FeedScreen({ user, showValidation = false }: { user: CampoUser; showValidation?: boolean }) {
  const posts = showValidation ? POSTS_CAMPO : POSTS_CAMPO.filter(p => p.userId === user.id);
  return (
    <div className="px-4 py-4">
      {/* New post button */}
      {!showValidation && (
        <button className="w-full rounded-2xl p-4 mb-4 flex items-center gap-3 transition-all active:scale-[0.98]"
          style={{ background: "white", border: `2px dashed ${C.border}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${C.accent}15` }}>
            <Camera size={18} style={{ color: C.accent }} />
          </div>
          <div className="text-left">
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: C.text }}>Novo Registro</p>
            <p style={{ fontSize: "0.55rem", color: C.textSec }}>Tire uma foto do serviço realizado</p>
          </div>
          <Plus size={18} style={{ color: C.accent, marginLeft: "auto" }} />
        </button>
      )}

      {showValidation && (
        <div className="rounded-xl p-3 mb-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
          <p style={{ fontSize: "0.65rem", color: "#92400E", fontWeight: 500 }}>
            {POSTS_CAMPO.filter(p => p.status === "pendente").length} postagens aguardando validação
          </p>
        </div>
      )}

      {posts.map(post => (
        <PostCard key={post.id} post={post} showValidation={showValidation} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TASKS SCREEN
   ═══════════════════════════════════════════════════════════════ */
function TasksScreen({ user }: { user: CampoUser }) {
  const tasks = TAREFAS_CAMPO.filter(t => t.userId === user.id);
  const [filter, setFilter] = useState<"all" | "pendente" | "andamento" | "concluida">("all");
  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["all", "pendente", "andamento", "concluida"] as const).map(f => {
          const labels = { all: "Todas", pendente: "Pendentes", andamento: "Em andamento", concluida: "Concluídas" };
          return (
            <button key={f} onClick={() => setFilter(f)} className="rounded-full px-3 py-1.5 whitespace-nowrap"
              style={{ fontSize: "0.6rem", fontWeight: filter === f ? 600 : 400, background: filter === f ? `${C.accent}15` : "#F3F4F6", color: filter === f ? C.accent : C.textSec, border: `1px solid ${filter === f ? `${C.accent}30` : "transparent"}` }}>
              {labels[f]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: "white", border: `1px solid ${C.border}` }}>
          <CheckCircle2 size={24} style={{ color: C.green, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.7rem", color: C.textSec }}>Nenhuma tarefa neste filtro</p>
        </div>
      ) : filtered.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RANKING SCREEN
   ═══════════════════════════════════════════════════════════════ */
function RankingScreen({ user }: { user: CampoUser }) {
  const sorted = [...RANKING].sort((a, b) => b.pontos - a.pontos);
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Podium */}
      <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A20)", border: "1px solid #FDE68A" }}>
        <Trophy size={28} style={{ color: "#D97706", margin: "0 auto 8px" }} />
        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text }}>Ranking da Semana</p>
        <div className="flex items-end justify-center gap-4 mt-4">
          {sorted.slice(0, 3).map((r, i) => {
            const heights = [80, 100, 70];
            const positions = [1, 0, 2]; // 2nd, 1st, 3rd
            const idx = positions[i];
            const entry = sorted[idx];
            if (!entry) return null;
            const colors = ["#C0C0C0", "#FFD700", "#CD7F32"];
            return (
              <div key={`podium-${entry.userId}`} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                  style={{ background: `${C.accent}20`, fontSize: "0.6rem", fontWeight: 700, color: C.accent, border: `2px solid ${colors[idx]}` }}>
                  {entry.avatar}
                </div>
                <p style={{ fontSize: "0.6rem", fontWeight: 600, color: C.text }}>{entry.nome.split(" ")[0]}</p>
                <div className="rounded-t-lg mt-1 flex items-end justify-center pb-1"
                  style={{ width: 50, height: heights[i], background: `${colors[idx]}30`, border: `1px solid ${colors[idx]}50` }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: C.text }}>{entry.pontos}</span>
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: colors[idx] }}>#{idx + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full ranking */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1px solid ${C.border}` }}>
        {sorted.map((r, i) => {
          const isMe = r.userId === user.id;
          return (
            <div key={r.userId} className="flex items-center gap-3 px-4 py-3"
              style={{ background: isMe ? `${C.accent}08` : "transparent", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: i < 3 ? "#D97706" : C.textDim, width: 24, textAlign: "center" }}>
                {i + 1}
              </span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `${C.accent}15`, fontSize: "0.5rem", fontWeight: 700, color: C.accent }}>
                {r.avatar}
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "0.72rem", fontWeight: isMe ? 700 : 500, color: C.text }}>
                  {r.nome} {isMe && <span style={{ color: C.accent }}>(Você)</span>}
                </p>
                <div className="flex gap-1 mt-0.5">
                  {r.badges.slice(0, 2).map(b => (
                    <span key={b} className="rounded-full px-1.5 py-0.5" style={{ fontSize: "0.4rem", fontWeight: 600, background: "#FEF3C7", color: "#D97706" }}>{b}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: C.accent }}>{r.pontos}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCTION SCREEN (Marceneiro Produção / Fábrica)
   ═══════════════════════════════════════════════════════════════ */
function ProductionScreen({ user }: { user: CampoUser }) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const ops = filterStatus === "all" ? ORDENS_PRODUCAO : ORDENS_PRODUCAO.filter(o => o.status === filterStatus);
  const statusColumns = ["fila", "cortando", "montando", "acabamento", "pronto", "entregue"];

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Em Produção", value: ORDENS_PRODUCAO.filter(o => ["cortando", "montando", "acabamento"].includes(o.status)).length, color: C.blue },
          { label: "Prontas", value: ORDENS_PRODUCAO.filter(o => o.status === "pronto").length, color: C.green },
          { label: "Na Fila", value: ORDENS_PRODUCAO.filter(o => o.status === "fila").length, color: C.yellow },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "white", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: s.color, display: "block" }}>{s.value}</span>
            <span style={{ fontSize: "0.5rem", color: C.textDim }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        <button onClick={() => setFilterStatus("all")} className="rounded-full px-3 py-1.5 whitespace-nowrap"
          style={{ fontSize: "0.55rem", fontWeight: filterStatus === "all" ? 600 : 400, background: filterStatus === "all" ? `${C.accent}15` : "#F3F4F6", color: filterStatus === "all" ? C.accent : C.textSec }}>
          Todas
        </button>
        {statusColumns.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className="rounded-full px-3 py-1.5 whitespace-nowrap capitalize"
            style={{ fontSize: "0.55rem", fontWeight: filterStatus === s ? 600 : 400, background: filterStatus === s ? `${C.accent}15` : "#F3F4F6", color: filterStatus === s ? C.accent : C.textSec }}>
            {s}
          </button>
        ))}
      </div>

      {/* OPs */}
      {ops.map(op => <OPCard key={op.id} op={op} />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FISCAL DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function FiscalDashboard({ user }: { user: CampoUser }) {
  const pendingPosts = POSTS_CAMPO.filter(p => p.status === "pendente").length;
  const todayCheckins = CHECKINS.filter(c => c.data === "08/03/2026").length;
  const obrasSupervisionadas = OBRAS_CAMPO.filter(o => o.fiscal === "Felipe" || o.fiscal === "Reinaldo");

  const presencaData = [
    { dia: "Seg", pres: 12 }, { dia: "Ter", pres: 14 }, { dia: "Qua", pres: 11 },
    { dia: "Qui", pres: 13 }, { dia: "Sex", pres: 15 }, { dia: "Sab", pres: 8 },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Greeting */}
      <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${C.teal}15, ${C.teal}05)`, border: `1px solid ${C.teal}25` }}>
        <p style={{ fontSize: "0.9rem", fontWeight: 600, color: C.text }}>{getGreeting()}, {user.nome.split(" ")[0]}!</p>
        <p style={{ fontSize: "0.6rem", color: C.textSec }}>Fiscal de Obras — Revestimento & Marcenaria</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Obras Ativas", value: obrasSupervisionadas.length, icon: HardHat, color: C.accent },
          { label: "Check-ins Hoje", value: todayCheckins, icon: MapPin, color: C.green },
          { label: "Posts Pendentes", value: pendingPosts, icon: Eye, color: C.yellow },
          { label: "Alertas", value: 2, icon: AlertTriangle, color: C.red },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-4" style={{ background: "white", border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: s.color }} />
                <span style={{ fontSize: "0.55rem", color: C.textDim }}>{s.label}</span>
              </div>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: C.text }}>{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* Presença chart */}
      <div className="rounded-2xl p-4" style={{ background: "white", border: `1px solid ${C.border}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: C.text, marginBottom: 12 }}>Presença da Semana</p>
        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={presencaData}>
              <XAxis key="xa" dataKey="dia" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis key="ya" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Bar key="bar" dataKey="pres" name="Presentes" fill={C.teal} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Obras */}
      <div>
        <p className="uppercase tracking-widest mb-2 px-1" style={{ fontSize: "0.45rem", color: C.textDim, fontWeight: 600 }}>Obras Supervisionadas</p>
        {obrasSupervisionadas.map(obra => (
          <div key={obra.id} className="rounded-xl p-4 mb-3" style={{ background: "white", border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: C.text }}>{obra.nome}</p>
              <span style={{ fontSize: "0.55rem", color: C.textDim }}>{obra.equipes.length} equipes</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 rounded-full" style={{ background: "#F3F4F6" }}>
                <div className="h-full rounded-full" style={{ width: `${obra.progresso}%`, background: C.accent }} />
              </div>
              <span style={{ fontSize: "0.6rem", fontWeight: 600, color: C.text }}>{obra.progresso}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="rounded-2xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} style={{ color: C.red }} />
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: C.red }}>Funcionários sem check-in</p>
        </div>
        <div className="space-y-1.5">
          <p style={{ fontSize: "0.65rem", color: "#991B1B" }}>Tiago M. — Equipe Gamma (OBR-004)</p>
          <p style={{ fontSize: "0.65rem", color: "#991B1B" }}>Diego A. — Equipe Epsilon (sem obra atribuída)</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FISCAL REPORT SCREEN
   ═══════════════════════════════════════════════════════════════ */
function FiscalReportScreen() {
  const [clima, setClima] = useState("sol");
  const [avanco, setAvanco] = useState("5");
  const [obs, setObs] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="rounded-2xl p-8" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
          <CheckCircle2 size={48} style={{ color: C.green, margin: "0 auto 12px" }} />
          <p style={{ fontSize: "1rem", fontWeight: 700, color: C.text }}>Relatório Enviado!</p>
          <p style={{ fontSize: "0.7rem", color: C.textSec, marginTop: 8 }}>Obrigado. O PMO receberá automaticamente.</p>
          <button onClick={() => setSent(false)} className="mt-4 rounded-xl px-6 py-2.5"
            style={{ background: `${C.accent}15`, color: C.accent, fontSize: "0.72rem", fontWeight: 600 }}>
            Novo Relatório
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl p-4" style={{ background: "white", border: `1px solid ${C.border}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: C.text, marginBottom: 12 }}>Relatório Diário Rápido</p>

        {/* Obra */}
        <label style={{ fontSize: "0.6rem", color: C.textDim, display: "block", marginBottom: 4 }}>Obra</label>
        <select className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none"
          style={{ fontSize: "0.72rem", background: "#F9FAFB", border: `1px solid ${C.border}`, color: C.text }}>
          {OBRAS_CAMPO.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {/* Clima */}
        <label style={{ fontSize: "0.6rem", color: C.textDim, display: "block", marginBottom: 4 }}>Condições Climáticas</label>
        <div className="flex gap-2 mb-4">
          {[{ id: "sol", emoji: "☀️" }, { id: "nublado", emoji: "⛅" }, { id: "chuva", emoji: "🌧️" }].map(c => (
            <button key={c.id} onClick={() => setClima(c.id)} className="flex-1 rounded-xl py-3 text-center transition-all"
              style={{ fontSize: "1.2rem", background: clima === c.id ? `${C.accent}15` : "#F9FAFB", border: `2px solid ${clima === c.id ? C.accent : C.border}` }}>
              {c.emoji}
            </button>
          ))}
        </div>

        {/* Avanco */}
        <label style={{ fontSize: "0.6rem", color: C.textDim, display: "block", marginBottom: 4 }}>Avanço do Dia (%)</label>
        <input type="number" value={avanco} onChange={e => setAvanco(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none"
          style={{ fontSize: "0.72rem", background: "#F9FAFB", border: `1px solid ${C.border}`, color: C.text }} />

        {/* Obs */}
        <label style={{ fontSize: "0.6rem", color: C.textDim, display: "block", marginBottom: 4 }}>Observações</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas do dia..."
          className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none resize-none"
          style={{ fontSize: "0.72rem", background: "#F9FAFB", border: `1px solid ${C.border}`, color: C.text, minHeight: 80 }} />

        {/* Photo upload placeholder */}
        <div className="rounded-xl p-4 mb-4 text-center" style={{ border: `2px dashed ${C.border}` }}>
          <Camera size={24} style={{ color: C.textDim, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.65rem", color: C.textSec }}>Tocar para adicionar fotos da obra</p>
        </div>

        <button onClick={() => setSent(true)} className="w-full rounded-xl py-3.5 transition-all active:scale-[0.98]"
          style={{ background: C.accent, color: "white", fontSize: "0.82rem", fontWeight: 700 }}>
          Enviar Relatório
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS SCREEN
   ═══════════════════════════════════════════════════════════════ */
function NotificationsScreen() {
  const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
    tarefa: { icon: ClipboardList, color: C.blue },
    aprovado: { icon: CheckCircle2, color: C.green },
    rejeitado: { icon: X, color: C.red },
    lembrete: { icon: Bell, color: C.yellow },
    aviso: { icon: MessageSquare, color: C.textSec },
  };

  return (
    <div className="px-4 py-4 space-y-2">
      {NOTIFICACOES.map(n => {
        const conf = iconMap[n.tipo] || iconMap.aviso;
        const Icon = conf.icon;
        return (
          <div key={n.id} className="flex items-start gap-3 rounded-xl p-3.5"
            style={{ background: n.lida ? "white" : `${conf.color}08`, border: `1px solid ${n.lida ? C.border : `${conf.color}20`}` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${conf.color}15` }}>
              <Icon size={14} style={{ color: conf.color }} />
            </div>
            <div>
              <p style={{ fontSize: "0.72rem", color: C.text, lineHeight: 1.5, fontWeight: n.lida ? 400 : 600 }}>{n.texto}</p>
              <p style={{ fontSize: "0.5rem", color: C.textDim, marginTop: 4 }}>{n.data}</p>
            </div>
            {!n.lida && <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: conf.color }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE SCREEN
   ═══════════════════════════════════════════════════════════════ */
function ProfileScreen({ user, onLogout }: { user: CampoUser; onLogout: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile card */}
      <div className="rounded-2xl p-5 text-center" style={{ background: "white", border: `1px solid ${C.border}` }}>
        <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ background: `${C.accent}20`, fontSize: "1.4rem", fontWeight: 700, color: C.accent }}>
          {user.avatar}
        </div>
        <p style={{ fontSize: "1rem", fontWeight: 700, color: C.text }}>{user.nome}</p>
        <p style={{ fontSize: "0.7rem", color: C.textSec, marginTop: 4 }}>{user.cargo}</p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="text-center">
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: C.accent }}>{user.pontos}</span>
            <p style={{ fontSize: "0.5rem", color: C.textDim }}>Pontos</p>
          </div>
          <div className="w-px h-8" style={{ background: C.border }} />
          <div className="text-center">
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#D97706" }}>#{user.ranking}</span>
            <p style={{ fontSize: "0.5rem", color: C.textDim }}>Ranking</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "white", border: `1px solid ${C.border}` }}>
        {[
          { label: "Matrícula", value: user.matricula },
          { label: "Setor", value: user.setor === "campo" ? "Campo" : user.setor === "marcenaria" ? "Marcenaria" : "Fábrica" },
          { label: "Telefone", value: user.telefone },
          { label: "Obra Atual", value: user.obraAtual ? OBRAS_CAMPO.find(o => o.id === user.obraAtual)?.nome || "—" : "—" },
        ].map(info => (
          <div key={info.label} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: "0.65rem", color: C.textDim }}>{info.label}</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 500, color: C.text }}>{info.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <button onClick={onLogout} className="w-full rounded-xl py-3 transition-all active:scale-[0.98]"
        style={{ background: "#FEF2F2", color: C.red, fontSize: "0.72rem", fontWeight: 600, border: "1px solid #FECACA" }}>
        Trocar Perfil
      </button>
      <button onClick={() => navigate("/")} className="w-full rounded-xl py-3 transition-all"
        style={{ background: "#F3F4F6", color: C.textSec, fontSize: "0.72rem" }}>
        Voltar ao Hub Central
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MAIN CAMPO APP — Router interno
   ═══════════════════════════════════════════════════════════════ */
export function CampoApp() {
  const [selectedProfile, setSelectedProfile] = useState<CampoProfile | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const campoData = useCampo();

  if (!selectedProfile) {
    return <ProfileSelector onSelect={(p) => { setSelectedProfile(p); setActiveTab("home"); }} />;
  }

  const user = CAMPO_USERS[selectedProfile];
  const profileConfig = CAMPO_PROFILES.find(p => p.id === selectedProfile)!;
  const isFiscal = selectedProfile === "fiscal";
  const isProduction = selectedProfile === "marceneiro-producao" || selectedProfile === "fabrica-diretor";

  const navItems = isFiscal
    ? [
        { id: "home", icon: Home, label: "Home" },
        { id: "validacao", icon: Eye, label: "Validação" },
        { id: "mapa", icon: MapPinned, label: "Mapa" },
        { id: "relatorio", icon: FileText, label: "Relatório" },
        { id: "perfil", icon: User, label: "Perfil" },
      ]
    : isProduction
    ? [
        { id: "home", icon: Home, label: "Home" },
        { id: "producao", icon: Factory, label: "Produção" },
        { id: "feed", icon: Camera, label: "Registros" },
        { id: "ranking", icon: Trophy, label: "Ranking" },
        { id: "perfil", icon: User, label: "Perfil" },
      ]
    : [
        { id: "home", icon: Home, label: "Home" },
        { id: "checkin", icon: MapPin, label: "Check-in" },
        { id: "feed", icon: Camera, label: "Feed" },
        { id: "tarefas", icon: ClipboardList, label: "Tarefas" },
        { id: "perfil", icon: User, label: "Perfil" },
      ];

  const titles: Record<string, string> = {
    home: `${profileConfig.icon} ${profileConfig.label}`,
    checkin: "Check-in / Check-out",
    feed: isFiscal ? "Validação de Serviços" : "Meus Registros",
    tarefas: "Minhas Tarefas",
    ranking: "Ranking",
    perfil: "Meu Perfil",
    producao: "Ordens de Produção",
    validacao: "Validação de Serviços",
    mapa: "Mapa de Equipe",
    relatorio: "Relatório Diário",
    notificacoes: "Notificações",
  };

  const unreadNotifs = campoData.unreadNotifs || NOTIFICACOES.filter(n => !n.lida).length;

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return isFiscal ? <FiscalDashboard user={user} /> : <WorkerDashboard user={user} profile={selectedProfile} />;
      case "checkin":
        return <CheckinScreen user={user} />;
      case "feed":
        return <FeedScreen user={user} />;
      case "tarefas":
        return <TasksScreen user={user} />;
      case "ranking":
        return <RankingScreen user={user} />;
      case "producao":
        return <ProductionScreen user={user} />;
      case "validacao":
        return <FeedScreen user={user} showValidation />;
      case "mapa":
        return (
          <div className="px-4 py-4">
            <div className="rounded-2xl overflow-hidden relative" style={{ height: 350, background: "#E5E7EB", border: `1px solid ${C.border}` }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <MapPinned size={40} style={{ color: C.accent }} />
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: C.text }}>Mapa de Equipe</p>
                <p style={{ fontSize: "0.6rem", color: C.textSec }}>5 equipes em 3 obras ativas</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2 px-6">
                  {OBRAS_CAMPO.filter(o => o.status === "ativa").slice(0, 3).map(o => (
                    <div key={o.id} className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: "white", border: `1px solid ${C.border}` }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.green }} />
                      <span style={{ fontSize: "0.55rem", fontWeight: 500, color: C.text }}>{o.nome.split(" — ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="uppercase tracking-widest px-1" style={{ fontSize: "0.45rem", color: C.textDim, fontWeight: 600 }}>Equipes com Check-in Hoje</p>
              {CHECKINS.filter(c => c.data === "08/03/2026").map(ck => (
                <div key={ck.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "white", border: `1px solid ${C.border}` }}>
                  <CheckCircle2 size={14} style={{ color: C.green }} />
                  <span style={{ fontSize: "0.68rem", color: C.text }}>{ck.userId.replace("u-", "").toUpperCase()}</span>
                  <span className="ml-auto font-mono" style={{ fontSize: "0.6rem", color: C.textSec }}>{ck.horaEntrada}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "relatorio":
        return <FiscalReportScreen />;
      case "notificacoes":
        return <NotificationsScreen />;
      case "perfil":
        return <ProfileScreen user={user} onLogout={() => setSelectedProfile(null)} />;
      default:
        return <WorkerDashboard user={user} profile={selectedProfile} />;
    }
  };

  return (
    <>
      <MobileShell
        title={titles[activeTab] || "Parketapp Obras"}
        onBack={activeTab !== "home" ? () => setActiveTab("home") : undefined}
        accent={profileConfig.color}
        rightAction={
          <button onClick={() => setActiveTab("notificacoes")} className="relative w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#F3F4F6" }}>
            <Bell size={16} style={{ color: C.text }} />
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: C.red, fontSize: "0.45rem", fontWeight: 700, color: "white" }}>
                {unreadNotifs}
              </span>
            )}
          </button>
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </MobileShell>
      <BottomNav items={navItems} active={activeTab} onSelect={setActiveTab} />
    </>
  );
}
