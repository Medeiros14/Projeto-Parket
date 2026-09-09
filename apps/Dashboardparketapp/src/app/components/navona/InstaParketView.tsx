import { useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Send, Camera, MoreHorizontal, MapPin, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import type { ThemeMode, ThemeTokens } from "./theme";
import parketLogo from "../../../imports/Captura_de_Tela_2026-06-12_a_s_12.20.58.png";

// ── Real obra photos ──────────────────────────────────────────────────────────
// Obra A — Casa Higienópolis — Parquet Nórdico (carvalho claro)
import obraA1 from "../../../imports/PHOTO-2026-03-20-16-15-04.jpg";
import obraA2 from "../../../imports/PHOTO-2026-03-20-16-15-06.jpg";
import obraA3 from "../../../imports/PHOTO-2026-03-20-16-15-07.jpg";
// Obra B — Edifício Itaim — Espinha de Peixe (hall elevadores)
import obraB1 from "../../../imports/PHOTO-2026-03-20-16-15-34.jpg";
import obraB2 from "../../../imports/PHOTO-2026-03-20-16-15-35.jpg";
// Obra C — Apê Brooklin — Parquet Jatobá escuro
import obraC1 from "../../../imports/PHOTO-2026-03-30-19-55-45.jpg";
import obraC2 from "../../../imports/PHOTO-2026-03-30-19-55-47.jpg";
import obraC3 from "../../../imports/PHOTO-2026-03-30-19-55-49.jpg";
// Obra D — Casa Morumbi — Forro de madeira área gourmet (série completa)
import obraD1 from "../../../imports/PHOTO-2026-03-30-19-56-25.jpg";
import obraD2 from "../../../imports/PHOTO-2026-03-30-19-56-35.jpg";
import obraD3 from "../../../imports/PHOTO-2026-03-30-19-56-36.jpg";
import obraD4 from "../../../imports/PHOTO-2026-03-30-19-56-40.jpg";
import obraD5 from "../../../imports/PHOTO-2026-03-30-19-56-41.jpg";
// Obra E — Painel de carvalho claro com porta embutida
import obraE1 from "../../../imports/PHOTO-2026-03-30-19-57-27.jpg";
import obraE2 from "../../../imports/PHOTO-2026-04-06-17-05-32.jpg";
import obraE3 from "../../../imports/PHOTO-2026-04-06-17-05-34.jpg";
import obraE4 from "../../../imports/PHOTO-2026-04-06-17-05-36.jpg";
// Obra F — Restauro de parquet antigo — lixamento
import obraF1 from "../../../imports/PHOTO-2026-04-07-12-09-15_2.jpg";
import obraF2 from "../../../imports/PHOTO-2026-04-07-12-09-15.jpg";

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY    = "'Inter', sans-serif";
const CREAM  = "#C8BDB1";
const CHAI   = "#968473";
const WALNUT = "#60544D";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Comment { user: string; dept: string; text: string }

interface Post {
  id: string;
  user: string;
  dept: string;
  deptColor: string;
  initials: string;
  time: string;
  obra: { nome: string; numero: string; area: string; tipo: string; cidade: string };
  caption: string;
  photos: string[];          // imported image bindings
  likes: number;
  likedByMe: boolean;
  comments: Comment[];
  showComments: boolean;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_POSTS: Post[] = [
  {
    id: "p1",
    user: "Davy",
    dept: "Operacional",
    deptColor: CHAI,
    initials: "DV",
    time: "há 47 min",
    obra: { nome: "Casa Higienópolis", numero: "PKT-031", area: "85m²", tipo: "Parquet Carvalho Nórdico", cidade: "São Paulo · SP" },
    caption: "Três ambientes entregues hoje. Parquet carvalho nórdico claro — sem verniz ainda, tá na cor natural. Ficou clean demais. Cliente escolheu bem.",
    photos: [obraA1, obraA2, obraA3],
    likes: 19,
    likedByMe: false,
    comments: [
      { user: "Felipe", dept: "Operacional", text: "Que acabamento limpo! Qual espessura?" },
      { user: "Raphael", dept: "Marketing", text: "Foto boa demais. Posso usar pro conteúdo?" },
      { user: "Douglas", dept: "CEO", text: "Belíssimo. Manda pro Raphael postar." },
    ],
    showComments: false,
  },
  {
    id: "p2",
    user: "Felipe",
    dept: "Operacional",
    deptColor: CHAI,
    initials: "FP",
    time: "há 2h",
    obra: { nome: "Edifício Itaim Bibi", numero: "PKT-035", area: "65m²", tipo: "Parquet Espinha de Peixe", cidade: "São Paulo · SP" },
    caption: "Hall do elevador — espinha de peixe. Detalhe técnico pesado, exigiu muito alinhamento. Resultado impecável. Ainda tem mais uma ala pra fechar.",
    photos: [obraB1, obraB2],
    likes: 34,
    likedByMe: true,
    comments: [
      { user: "Davy", dept: "Operacional", text: "Espinha de peixe sempre dá trabalho mas valeu!" },
      { user: "Thainara", dept: "Projetos", text: "Confere a medição do rodapé antes de fechar ok?" },
      { user: "Vinicius", dept: "Operacional", text: "Que detalhe no chevron! Como ficou o corte da borda?" },
    ],
    showComments: false,
  },
  {
    id: "p3",
    user: "Vinicius",
    dept: "Operacional",
    deptColor: CHAI,
    initials: "VN",
    time: "há 5h",
    obra: { nome: "Apê Brooklin", numero: "PKT-038", area: "110m²", tipo: "Parquet Jatobá", cidade: "São Paulo · SP" },
    caption: "Jatobá escuro instalado, aguardando 48h pra verniz. A madeira tá pedindo verniz fosco. Ficou um espelho, cliente vai amar. Equipe mandou bem hoje.",
    photos: [obraC1, obraC2, obraC3],
    likes: 27,
    likedByMe: false,
    comments: [
      { user: "Douglas", dept: "CEO", text: "Esse vai virar case certamente. Manda foto do after com verniz." },
      { user: "Raphael", dept: "Marketing", text: "Preciso dessa foto HOJE pra post 🔥" },
      { user: "Felipe", dept: "Operacional", text: "Jatobá escuro no apê — combinação perfeita." },
    ],
    showComments: false,
  },
  {
    id: "p4",
    user: "Germano",
    dept: "Producao",
    deptColor: WALNUT,
    initials: "GE",
    time: "há 1 dia",
    obra: { nome: "Casa Morumbi — Área Gourmet", numero: "PKT-040", area: "Forro 48m²", tipo: "Lambri de Madeira", cidade: "São Paulo · SP" },
    caption: "Forro de lambri finalizado na área gourmet. Material beneficiado aqui na marcenaria, saiu no ponto certo. Estrutura recebeu tudo direitinho.",
    photos: [obraD1],
    likes: 11,
    likedByMe: false,
    comments: [
      { user: "Davy", dept: "Operacional", text: "Madeira perfeita! Nenhum empenamento." },
      { user: "Thainara", dept: "Projetos", text: "Passando o check de qualidade amanhã." },
    ],
    showComments: false,
  },
  {
    id: "p5",
    user: "Germano",
    dept: "Producao",
    deptColor: WALNUT,
    initials: "GE",
    time: "há 1 dia",
    obra: { nome: "Casa Morumbi — Cobertura Externa", numero: "PKT-040", area: "Estrutura 120m²", tipo: "Forro + Vigas de Madeira", cidade: "São Paulo · SP" },
    caption: "Obra grande, estrutura toda em madeira. As vigas ficaram espetaculares. Detalhe do canto externo em leque — saiu exatamente como o projeto do Thainara pediu. Nível arquitetônico.",
    photos: [obraD2, obraD3, obraD4, obraD5],
    likes: 41,
    likedByMe: false,
    comments: [
      { user: "Douglas", dept: "CEO", text: "Essa obra vai virar portfólio da empresa. Foto aérea quando terminar." },
      { user: "Raphael", dept: "Marketing", text: "Preciso de um ensaio fotográfico profissional nessa obra urgente!" },
      { user: "Thainara", dept: "Projetos", text: "Projeto entregue perfeitamente. Parabéns à equipe da marcenaria!" },
      { user: "Felipe", dept: "Operacional", text: "Que obra, meu! Nível outro completamente." },
    ],
    showComments: false,
  },
  {
    id: "p6",
    user: "Vinicius",
    dept: "Operacional",
    deptColor: CHAI,
    initials: "VN",
    time: "há 2 dias",
    obra: { nome: "Cobertura Jardins — Painel Sala", numero: "PKT-043", area: "Painel 14ml × 3m", tipo: "Painel Carvalho Claro + Porta Embutida", cidade: "São Paulo · SP" },
    caption: "Painel de carvalho claro com porta embutida — 14 metros lineares na sala principal. Marcenaria da Germano entregou no ponto. Instalação levou 2 dias, resultado é premium. Cliente não acreditou quando abriu a porta embutida.",
    photos: [obraE1, obraE2, obraE3, obraE4],
    likes: 56,
    likedByMe: true,
    comments: [
      { user: "Douglas", dept: "CEO", text: "Isso aqui é o nosso diferencial. Simplesmente impecável." },
      { user: "Germano", dept: "Producao", text: "Saiu no ponto da usinagem! A porta deslizou perfeita?" },
      { user: "Vinicius", dept: "Operacional", text: "Perfeita! Folga de 1mm exata como solicitou." },
      { user: "Pamela", dept: "CEO", text: "Que obra linda!! Vou no cliente fotografar semana que vem." },
      { user: "Raphael", dept: "Marketing", text: "Esse painel virou capa do catálogo 2026. Sem discussão." },
    ],
    showComments: false,
  },
  {
    id: "p7",
    user: "Felipe",
    dept: "Operacional",
    deptColor: CHAI,
    initials: "FP",
    time: "há 3 dias",
    obra: { nome: "Restauro Pinheiros — Salão Comercial", numero: "PKT-044", area: "280m²", tipo: "Restauro Parquet Antigo — Lixamento", cidade: "São Paulo · SP" },
    caption: "Restauro de parquet de mais de 30 anos. Piso totalmente gasto, manchado, remendado com tinta. Lixamento completo iniciado. Quando terminar vai parecer novo — é pra isso que a Parket existe.",
    photos: [obraF1, obraF2],
    likes: 23,
    likedByMe: false,
    comments: [
      { user: "Davy", dept: "Operacional", text: "Quantas lixas vai levar esse piso?" },
      { user: "Felipe", dept: "Operacional", text: "Estimativa de 3 passadas. Muita tinta velha nele." },
      { user: "Thainara", dept: "Projetos", text: "Checando o levantamento de umidade antes do verniz final." },
    ],
    showComments: false,
  },
];

// ── Photo Carousel ────────────────────────────────────────────────────────────

function PhotoCarousel({ photos, T }: { photos: string[]; T: ThemeTokens }) {
  // Última foto postada aparece primeiro
  const ordered = [...photos].reverse();
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (i === 0 ? ordered.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === ordered.length - 1 ? 0 : i + 1));

  return (
    <div style={{ position: "relative", backgroundColor: "#0A0806", userSelect: "none" }}>
      {/* Photo */}
      <div style={{ width: "100%", height: 360, overflow: "hidden", position: "relative" }}>
        <img
          key={ordered[idx]}
          src={ordered[idx]}
          alt={`foto ${idx + 1}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
            transition: "opacity 0.2s",
          }}
        />
        {/* Gradient overlay bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
          background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
          pointerEvents: "none",
        }} />
        {/* Counter badge */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          backgroundColor: "rgba(0,0,0,0.55)",
          padding: "3px 9px",
          fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.8)",
        }}>
          {idx + 1} / {ordered.length}
        </div>
      </div>

      {/* Arrows — only if more than 1 photo */}
      {ordered.length > 1 && (
        <>
          <button
            onClick={prev}
            style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32,
              backgroundColor: "rgba(0,0,0,0.50)",
              border: "none", borderRadius: "50%",
              cursor: "pointer", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.78)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.50)")}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32,
              backgroundColor: "rgba(0,0,0,0.50)",
              border: "none", borderRadius: "50%",
              cursor: "pointer", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.78)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.50)")}
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Dots */}
      {ordered.length > 1 && (
        <div style={{
          position: "absolute", bottom: 12, left: 0, right: 0,
          display: "flex", justifyContent: "center", gap: 5,
          pointerEvents: "none",
        }}>
          {ordered.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 18 : 6,
                height: 4,
                borderRadius: 2,
                backgroundColor: i === idx ? CREAM : "rgba(255,255,255,0.35)",
                transition: "width 0.25s, background-color 0.25s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, onToggleLike, onToggleComments, T }: {
  post: Post;
  onToggleLike: (id: string) => void;
  onToggleComments: (id: string) => void;
  T: ThemeTokens;
}) {
  const [commentText, setCommentText] = useState("");

  return (
    <div style={{
      border: `1px solid ${T.border}`,
      backgroundColor: T.cardBg,
      marginBottom: 2,
      transition: "background 0.35s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `1px solid ${post.deptColor}60`,
            backgroundColor: `${post.deptColor}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT_BODY, fontSize: 10, letterSpacing: "0.06em",
            color: post.deptColor, flexShrink: 0,
          }}>
            {post.initials}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textPrimary }}>
                {post.user}
              </span>
              <span style={{
                fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.12em",
                color: post.deptColor, border: `1px solid ${post.deptColor}40`,
                padding: "1px 6px",
              }}>{post.dept.toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={8} color={T.textMuted} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted }}>
                {post.obra.cidade} · {post.time}
              </span>
            </div>
          </div>
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }}>
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Obra card */}
      <div style={{
        margin: "0 16px 10px",
        border: `1px solid ${T.border}`,
        backgroundColor: T.statBg,
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.16em", color: T.textMuted, marginBottom: 4 }}>
            {post.obra.numero}
          </p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.08em", color: T.textPrimary, fontWeight: 400, marginBottom: 3 }}>
            {post.obra.nome.toUpperCase()}
          </p>
          <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textSecondary }}>
            {post.obra.area} · {post.obra.tipo}
          </p>
        </div>
        <div style={{
          fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.1em",
          color: CHAI, border: `1px solid ${CHAI}40`, padding: "3px 8px",
        }}>
          {post.photos.length} {post.photos.length === 1 ? "FOTO" : "FOTOS"}
        </div>
      </div>

      {/* Photo carousel */}
      <PhotoCarousel photos={post.photos} T={T} />

      {/* Caption */}
      <div style={{ padding: "12px 16px 10px" }}>
        <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textSecondary, lineHeight: 1.7, fontWeight: 300 }}>
          <span style={{ color: T.textPrimary, fontWeight: 400 }}>{post.user} </span>
          {post.caption}
        </p>
      </div>

      {/* Actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderTop: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            onClick={() => onToggleLike(post.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: post.likedByMe ? CREAM : T.textMuted,
              fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.08em",
              transition: "color 0.15s",
            }}
          >
            <Heart size={14} fill={post.likedByMe ? CREAM : "none"} color={post.likedByMe ? CREAM : T.textMuted} />
            {post.likes + (post.likedByMe ? 1 : 0)}
          </button>
          <button
            onClick={() => onToggleComments(post.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: post.showComments ? CHAI : T.textMuted,
              fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.08em",
              transition: "color 0.15s",
            }}
          >
            <MessageCircle size={14} />
            {post.comments.length}
          </button>
        </div>
        <button style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: T.textMuted, fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em",
        }}>
          <Send size={12} /> COMPARTILHAR
        </button>
      </div>

      {/* Comments */}
      {post.showComments && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px" }}>
          {post.comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                border: `1px solid ${T.border}`, backgroundColor: T.cardBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT_BODY, fontSize: 7, color: T.textSecondary, flexShrink: 0,
              }}>
                {c.user.charAt(0)}
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary, lineHeight: 1.6 }}>
                <span style={{ color: T.textPrimary, fontWeight: 500 }}>{c.user} </span>
                <span style={{
                  fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.1em",
                  color: T.textMuted, border: `1px solid ${T.border}`,
                  padding: "1px 5px", marginRight: 6,
                }}>{c.dept}</span>
                {c.text}
              </p>
            </div>
          ))}
          {/* Input */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              border: `1px solid ${T.border}`, backgroundColor: T.cardBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT_BODY, fontSize: 7, color: T.textSecondary, flexShrink: 0,
            }}>DP</div>
            <div style={{ flex: 1, display: "flex", gap: 6 }}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Adicionar um comentário..."
                style={{
                  flex: 1, padding: "5px 10px",
                  backgroundColor: T.inputBg, border: `1px solid ${T.border}`,
                  color: T.textPrimary, fontFamily: FONT_BODY, fontSize: 10, outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = CHAI)}
                onBlur={(e) => (e.currentTarget.style.borderColor = String(T.border))}
              />
              <button style={{
                padding: "5px 12px", border: `1px solid ${T.border}`, background: "none",
                cursor: "pointer", color: T.textMuted,
                fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.12em",
              }}>PUBLICAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface InstaParketViewProps {
  onBack: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  T: ThemeTokens;
}

export function InstaParketView({ onBack, theme, onToggleTheme, T }: InstaParketViewProps) {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);

  const toggleLike = (id: string) =>
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, likedByMe: !p.likedByMe } : p));

  const toggleComments = (id: string) =>
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, showComments: !p.showComments } : p));

  const contributors = [
    { name: "Davy",     dept: "Operacional", posts: 12, initials: "DV", color: CHAI   },
    { name: "Felipe",   dept: "Operacional", posts: 9,  initials: "FP", color: CHAI   },
    { name: "Vinicius", dept: "Operacional", posts: 8,  initials: "VN", color: CHAI   },
    { name: "Germano",  dept: "Producao",    posts: 5,  initials: "GE", color: WALNUT },
    { name: "Natalia",  dept: "Fiscal",      posts: 4,  initials: "NT", color: WALNUT },
    { name: "Raphael",  dept: "Marketing",   posts: 7,  initials: "RP", color: "#AAA297" },
  ];

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100vh", color: T.textPrimary, transition: "background 0.35s" }}>
      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10,
        borderBottom: `1px solid ${T.border}`,
        padding: "0 32px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        backgroundColor: T.headerBg, backdropFilter: "blur(12px)", transition: "background 0.35s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex", padding: 4 }}>
            <ArrowLeft size={14} />
          </button>
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <img src={parketLogo} alt="Parket" style={{ height: 14, filter: theme === "light" ? "invert(1)" : "none", transition: "filter 0.35s" }} />
          <div style={{ width: 1, height: 16, backgroundColor: T.border }} />
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: "0.2em", color: T.textPrimary }}>
            INSTAPARKET
          </p>
          <span style={{
            fontFamily: FONT_BODY, fontSize: 7, letterSpacing: "0.14em",
            color: CREAM, backgroundColor: `${CHAI}28`, border: `1px solid ${CHAI}50`,
            padding: "2px 8px",
          }}>FEED INTERNO</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onToggleTheme} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
            border: `1px solid ${T.border}`, background: T.cardBg, cursor: "pointer",
            fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.12em", color: T.textSecondary,
          }}>
            {theme === "dark" ? <><Sun size={10} /> CLARO</> : <><Moon size={10} /> ESCURO</>}
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 7, padding: "5px 16px",
            border: `1px solid ${T.borderHover}`, background: T.cardBg, cursor: "pointer",
            color: T.textPrimary, fontFamily: FONT_BODY, fontSize: 9, letterSpacing: "0.14em",
          }}>
            <Camera size={11} /> POSTAR FOTO
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ paddingTop: 52, display: "flex", maxWidth: 1060, margin: "0 auto" }}>
        {/* Feed */}
        <div style={{ flex: 1, padding: "24px 24px 80px" }}>
          <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 5 }}>
              TIMELINE · {posts.length} PUBLICAÇÕES
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textSecondary }}>
              Fotos de obras, levantamentos e registros das equipes Parket em campo.
            </p>
          </div>

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onToggleLike={toggleLike}
              onToggleComments={toggleComments}
              T={T}
            />
          ))}
        </div>

        {/* Right sidebar */}
        <div style={{
          width: 250, flexShrink: 0,
          padding: "24px 0 80px",
          borderLeft: `1px solid ${T.border}`,
        }}>
          <div style={{ padding: "0 20px" }}>
            <p style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 14 }}>
              MAIS ATIVOS — JUNHO
            </p>
            {contributors.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: `1px solid ${c.color}50`,
                  backgroundColor: `${c.color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT_BODY, fontSize: 8, color: c.color,
                }}>{c.initials}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: T.textPrimary, marginBottom: 1 }}>{c.name}</p>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 8, color: T.textMuted, letterSpacing: "0.06em" }}>{c.dept}</p>
                </div>
                <span style={{ fontFamily: FONT_BODY, fontSize: 8, color: T.textMuted }}>{c.posts}</span>
              </div>
            ))}

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 12 }}>
                TAGS
              </p>
              {["#parquet","#instalação","#piso","#obra","#carvalho","#jatobá","#espinha-de-peixe","#forro","#antes-e-depois","#equipe"].map((tag) => (
                <button key={tag} style={{
                  display: "inline-block", margin: "0 4px 6px 0",
                  padding: "3px 9px", border: `1px solid ${T.border}`,
                  background: "none", cursor: "pointer",
                  fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.06em", color: T.textMuted,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = CHAI; e.currentTarget.style.color = CREAM; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = String(T.border); e.currentTarget.style.color = String(T.textMuted); }}
                >{tag}</button>
              ))}
            </div>

            {/* Stats */}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: 8, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 12 }}>
                ESTE MÊS
              </p>
              {[
                { label: "Fotos postadas", value: 57 },
                { label: "Obras registradas", value: 19 },
                { label: "Curtidas", value: 341 },
                { label: "Comentários", value: 98 },
              ].map((s) => (
                <div key={s.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 9,
                }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: T.textMuted }}>{s.label}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textPrimary }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
