import type { CSSProperties } from "react";
import { SectionHeader } from "./SectionHeader";

const incorrectUses = [
  "Não distorcer o logotipo",
  "Não aplicar sombra",
  "Não usar degradê",
  "Não usar dourado metálico",
  "Não usar textura dentro da letra",
  "Não aplicar sobre imagem poluída",
  "Não usar ícone de coluna romana",
  "Não usar símbolo do Coliseu",
  "Não usar brasão ou ornamentos",
  "Não usar fonte cursiva",
  "Não usar caixa baixa no logotipo",
  "Não alterar espaçamento sem critério",
  "Não usar cores fora da paleta",
  "Não usar contorno nas letras",
];

const pillars = [
  {
    number: "I",
    title: "PALAVRA FORTE",
    body: "O logotipo é a marca. Não precisa de símbolo.",
  },
  {
    number: "II",
    title: "PALETA CURTA",
    body: "Preto, bege, off white e cinza mineral.",
  },
  {
    number: "III",
    title: "ROMA SEM FANTASIA",
    body: "Referência clássica, mas sem ornamento literal.",
  },
  {
    number: "IV",
    title: "MATERIAL EM PRIMEIRO PLANO",
    body: "A pedra deve ser protagonista.",
  },
  {
    number: "V",
    title: "CLAREZA COMERCIAL",
    body: "A marca vende chapa e ladrilho. Sem prometer instalação.",
  },
];

const signatures = [
  { type: "ASSINATURA PRINCIPAL", line1: "NAVONA", line2: "Travertino Romano" },
  { type: "INSTITUCIONAL", line1: "NAVONA", line2: "Importação direta de travertino romano" },
  { type: "COMERCIAL", line1: "NAVONA", line2: "Chapas e ladrilhos de travertino romano" },
  { type: "INCORPORAÇÃO", line1: "NAVONA", line2: "Travertino romano para grandes projetos" },
];

export function SystemSection() {
  return (
    <>
      {/* Usos Incorretos */}
      <section
        id="incorretos"
        style={{ backgroundColor: "#F3F0E8", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="10" title="USOS INCORRETOS" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
            }}
            className="max-md:grid-cols-1"
          >
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                  marginBottom: 40,
                }}
              >
                {/* Incorrect use examples */}
                {[
                  {
                    label: "Sombra",
                    style: {
                      fontFamily: "'Cinzel', serif",
                      fontSize: 18,
                      color: "#050505",
                      letterSpacing: "0.15em",
                      textShadow: "3px 3px 6px rgba(0,0,0,0.4)",
                    },
                  },
                  {
                    label: "Degradê",
                    style: {
                      fontFamily: "'Cinzel', serif",
                      fontSize: 18,
                      letterSpacing: "0.15em",
                      background: "linear-gradient(135deg, #c49a00, #f5d020)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    },
                  },
                  {
                    label: "Caixa baixa",
                    style: {
                      fontFamily: "'Cinzel', serif",
                      fontSize: 18,
                      color: "#050505",
                      letterSpacing: "0.15em",
                    },
                    text: "navona",
                  },
                  {
                    label: "Distorção",
                    style: {
                      fontFamily: "'Cinzel', serif",
                      fontSize: 18,
                      color: "#050505",
                      letterSpacing: "0.15em",
                      transform: "scaleX(1.5)",
                      display: "inline-block",
                    },
                  },
                ].map((ex) => (
                  <div
                    key={ex.label}
                    style={{
                      backgroundColor: "#D8D3C7",
                      padding: "32px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <p style={ex.style as CSSProperties}>{ex.text || "NAVONA"}</p>
                      {/* X mark */}
                      <div
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -12,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          backgroundColor: "#050505",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ color: "#F3F0E8", fontSize: 9, lineHeight: 1 }}>✕</span>
                      </div>
                    </div>
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 8,
                        letterSpacing: "0.12em",
                        color: "#77736A",
                      }}
                    >
                      {ex.label.toUpperCase()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#050505",
                  opacity: 0.4,
                  marginBottom: 32,
                }}
              >
                REGRAS COMPLETAS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {incorrectUses.map((rule) => (
                  <div key={rule} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 14, height: 1, backgroundColor: "rgba(5,5,5,0.2)", flexShrink: 0 }} />
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                        color: "#77736A",
                        lineHeight: 1.5,
                      }}
                    >
                      {rule}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sistema de Marca */}
      <section
        id="sistema"
        style={{ backgroundColor: "#050505", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="11" title="SISTEMA DE MARCA" dark />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 2,
              marginBottom: 96,
            }}
            className="max-md:grid-cols-2 max-sm:grid-cols-1"
          >
            {pillars.map((p) => (
              <div
                key={p.number}
                style={{
                  borderTop: "1px solid rgba(216,211,199,0.15)",
                  paddingTop: 32,
                  paddingRight: 16,
                  paddingBottom: 32,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 24,
                    color: "#D8D3C7",
                    opacity: 0.15,
                    marginBottom: 24,
                    letterSpacing: "0.05em",
                  }}
                >
                  {p.number}
                </p>
                <p
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "#D8D3C7",
                    marginBottom: 16,
                  }}
                >
                  {p.title}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: "#77736A",
                    lineHeight: 1.7,
                  }}
                >
                  {p.body}
                </p>
              </div>
            ))}
          </div>

          {/* Conceito central */}
          <div
            style={{
              borderTop: "1px solid rgba(216,211,199,0.08)",
              paddingTop: 80,
              maxWidth: 640,
            }}
          >
            <p
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "#D8D3C7",
                opacity: 0.4,
                marginBottom: 40,
              }}
            >
              CONCEITO CENTRAL
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 16,
                color: "#D8D3C7",
                lineHeight: 1.9,
                fontWeight: 300,
                opacity: 0.75,
              }}
            >
              A Navona é uma marca de foco. Enquanto o mercado tenta vender todos os tipos de pedra,
              a Navona escolhe uma categoria e constrói autoridade nela.
            </p>
            <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Travertino romano.", "Chapas e ladrilhos.", "Importação direta.", "Fornecimento claro."].map((line) => (
                <p
                  key={line}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 11,
                    color: "#D8D3C7",
                    letterSpacing: "0.12em",
                    opacity: 0.5,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Assinaturas de Marca */}
      <section
        id="assinaturas"
        style={{ backgroundColor: "#D8D3C7", padding: "120px 0" }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
          <SectionHeader number="12" title="ASSINATURAS DE MARCA" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 2,
            }}
            className="max-md:grid-cols-1"
          >
            {signatures.map((sig, i) => (
              <div
                key={sig.type}
                style={{
                  backgroundColor: i % 2 === 0 ? "#050505" : "#F3F0E8",
                  padding: "64px 48px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 220,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 8,
                    letterSpacing: "0.2em",
                    color: i % 2 === 0 ? "#77736A" : "#77736A",
                  }}
                >
                  {sig.type}
                </p>
                <div>
                  <p
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 22,
                      letterSpacing: "0.25em",
                      color: i % 2 === 0 ? "#D8D3C7" : "#050505",
                      marginBottom: 8,
                    }}
                  >
                    {sig.line1}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: "#77736A",
                      fontWeight: 300,
                    }}
                  >
                    {sig.line2}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final closing section */}
      <section
        style={{ backgroundColor: "#050505", padding: "160px 0 120px" }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 80px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 48,
              letterSpacing: "0.3em",
              color: "#D8D3C7",
              fontWeight: 400,
              marginBottom: 48,
            }}
          >
            NAVONA
          </p>
          <div style={{ width: 32, height: 1, backgroundColor: "rgba(216,211,199,0.2)", marginBottom: 32 }} />
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              color: "#77736A",
              letterSpacing: "0.2em",
              marginBottom: 4,
            }}
          >
            TRAVERTINO ROMANO
          </p>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              color: "#77736A",
              letterSpacing: "0.15em",
              opacity: 0.5,
            }}
          >
            MANUAL DE IDENTIDADE VISUAL — 2026
          </p>
        </div>
      </section>
    </>
  );
}
