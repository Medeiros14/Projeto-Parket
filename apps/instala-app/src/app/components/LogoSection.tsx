import { SectionHeader } from "./SectionHeader";

export function LogoSection() {
  return (
    <section
      id="logotipo"
      style={{ backgroundColor: "#F3F0E8", padding: "120px 0" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 80px" }}>
        <SectionHeader number="03" title="LOGOTIPO" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 2,
            marginBottom: 100,
          }}
          className="max-md:grid-cols-1"
        >
          {/* Versão Positiva — logo preto sobre fundo bege */}
          <div>
            <div
              style={{
                backgroundColor: "#D8D3C7",
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 40,
                  letterSpacing: "0.28em",
                  color: "#050505",
                  fontWeight: 400,
                }}
              >
                NAVONA
              </p>
            </div>
            <div style={{ padding: "24px 0" }}>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "#050505",
                  marginBottom: 8,
                }}
              >
                VERSÃO POSITIVA
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  color: "#77736A",
                  lineHeight: 1.7,
                }}
              >
                Logotipo preto sobre fundo bege claro.<br />
                Uso principal em apresentações, catálogos, site e documentos institucionais.
              </p>
            </div>
          </div>

          {/* Versão Negativa — logo bege sobre fundo preto */}
          <div>
            <div
              style={{
                backgroundColor: "#050505",
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 40,
                  letterSpacing: "0.28em",
                  color: "#D8D3C7",
                  fontWeight: 400,
                }}
              >
                NAVONA
              </p>
            </div>
            <div style={{ padding: "24px 0" }}>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "#050505",
                  marginBottom: 8,
                }}
              >
                VERSÃO NEGATIVA
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  color: "#77736A",
                  lineHeight: 1.7,
                }}
              >
                Logotipo bege claro sobre fundo preto.<br />
                Uso principal em capas, embalagens premium, cartões e materiais de impacto.
              </p>
            </div>
          </div>
        </div>

        {/* Princípios do logotipo */}
        <div
          style={{
            borderTop: "1px solid rgba(5,5,5,0.1)",
            paddingTop: 64,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 48,
          }}
          className="max-md:grid-cols-1"
        >
          {[
            {
              title: "PALAVRA FORTE",
              body: "O logotipo é a marca. A força está na palavra NAVONA. Não precisa de símbolo, ícone ou ornamento adicional.",
            },
            {
              title: "CAIXA ALTA",
              body: "Sempre em caixa alta. As maiúsculas reforçam autoridade, arquitetura e origem romana.",
            },
            {
              title: "ESPAÇAMENTO",
              body: "Controlado. Aberto o suficiente para transmitir sofisticação, próximo o bastante para manter presença.",
            },
          ].map((item) => (
            <div key={item.title}>
              <p
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "#050505",
                  marginBottom: 16,
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  color: "#77736A",
                  lineHeight: 1.8,
                }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
