import travertino from "../../../imports/Captura_de_Tela_2026-06-11_a_s_14.29.35.png";
import { BPWrap, BPSectionHeader, BPBody, BPSmall, BPLabel, BPDivider } from "./BPShared";

const tipos = [
  { tipo: "TRAVERTINO NAVONA", acabamentos: "Filled & Honed", formatos: "60×60, 60×120, 60×200 cm", uso: "Ambientes premium de alto padrão" },
  { tipo: "TRAVERTINO CLÁSSICO LIGHT", acabamentos: "Livre — Conforme lote", formatos: "60×60, 60×120, 60×200 cm", uso: "Ambientes claros e luminosos" },
  { tipo: "TRAVERTINO CLÁSSICO", acabamentos: "Livre — Conforme lote", formatos: "60×60, 60×120, 60×200 cm", uso: "Pisos, revestimentos, fachadas" },
  { tipo: "TRAVERTINO RED", acabamentos: "Livre — Conforme lote", formatos: "60×60, 60×120 cm", uso: "Accent walls, ambientes bold" },
  { tipo: "TRAVERTINO CHOCOLATE", acabamentos: "Livre — Conforme lote", formatos: "60×60, 60×120 cm", uso: "Projetos contemporâneos e sofisticados" },
  { tipo: "TRAVERTINO SILVER", acabamentos: "Livre — Conforme lote", formatos: "60×60, 60×120, 60×200 cm", uso: "Pisos, fachadas, projetos residenciais" },
  { tipo: "TRAVERTINO EM CHAPA", acabamentos: "Livre — Conforme lote", formatos: "Chapas inteiras 280×160 cm (aprox.)", uso: "Bancadas, revestimentos especiais, marcenaria" },
];

const diferenciais = [
  { title: "SELEÇÃO NA ORIGEM", body: "Materiais selecionados diretamente nas pedreiras italianas. Controle visual e técnico antes do embarque." },
  { title: "ESTOQUE PERMANENTE", body: "Disponibilidade imediata. Nenhum projeto travado por prazo de importação." },
  { title: "CONSISTÊNCIA VISUAL", body: "Lotes selecionados para uniformidade de tonalidade e veios, atendendo projetos de grande escala." },
  { title: "FORNECIMENTO CONFIÁVEL", body: "Contratos de fornecimento de longo prazo com pedreiras parceiras garantem continuidade dos lotes." },
];

export function BPProduto() {
  return (
    <BPWrap id="bp-produto">
      <BPSectionHeader number="02" title="O PRODUTO" subtitle="Travertino Romano — Chapas e Ladrilhos" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginBottom: 80 }} className="max-md:grid-cols-1">
        <div>
          <BPLabel>O QUE É TRAVERTINO ROMANO</BPLabel>
          <BPBody>
            O travertino é uma pedra natural calcária formada pela precipitação de carbonato de cálcio em fontes termais e calcárias.
            O travertino romano — extraído principalmente da região de Tivoli, próxima a Roma —
            é reconhecido mundialmente pela qualidade superior, tonalidades quentes e veios característicos.
          </BPBody>
          <div style={{ marginTop: 28 }}>
            <BPBody>
              É um dos materiais mais utilizados na arquitetura clássica e contemporânea de alto padrão,
              presente em projetos icônicos como o Coliseu, o Getty Center e grandes obras hoteleiras e corporativas ao redor do mundo.
            </BPBody>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <img
            src={travertino}
            alt="Travertino Romano"
            style={{ width: "100%", height: 320, objectFit: "cover" }}
          />
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px 20px",
            backgroundColor: "rgba(5,5,5,0.6)",
            display: "flex",
            justifyContent: "space-between",
          }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.12em" }}>TRAVERTINO ROMANO</p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.12em" }}>ORIGEM: ITÁLIA</p>
          </div>
        </div>
      </div>

      {/* Diferenciais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, marginBottom: 80 }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
        {diferenciais.map((d) => (
          <div key={d.title} style={{ borderTop: "2px solid #050505", padding: "28px 0 28px" }}>
            <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.16em", color: "#050505", marginBottom: 16 }}>
              {d.title}
            </p>
            <BPSmall>{d.body}</BPSmall>
          </div>
        ))}
      </div>

      <BPDivider />

      {/* Tabela de Produtos */}
      <div>
        <BPLabel>LINHA DE PRODUTOS DISPONÍVEIS</BPLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1.5fr 2fr",
            borderBottom: "1px solid rgba(5,5,5,0.15)",
            paddingBottom: 12,
            gap: 16,
          }} className="max-md:hidden">
            {["TIPO", "ACABAMENTOS", "FORMATOS", "APLICAÇÃO"].map((h) => (
              <p key={h} style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.18em", color: "#77736A" }}>{h}</p>
            ))}
          </div>
          {tipos.map((t, i) => (
            <div
              key={t.tipo}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1.5fr 2fr",
                borderBottom: "1px solid rgba(5,5,5,0.06)",
                padding: "22px 0",
                gap: 16,
                backgroundColor: i % 2 === 0 ? "transparent" : "rgba(5,5,5,0.02)",
              }}
              className="max-md:grid-cols-1"
            >
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.1em", color: "#050505" }}>{t.tipo}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{t.acabamentos}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{t.formatos}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{t.uso}</p>
            </div>
          ))}
        </div>
      </div>
    </BPWrap>
  );
}
