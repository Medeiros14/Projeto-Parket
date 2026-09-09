import { useState } from "react";
import travertino from "../../../imports/Captura_de_Tela_2026-06-11_a_s_14.29.35.png";
import { PBModuleNav, PBHero, PBWrap, PBSectionHeader, PBBody, PBSmall, PBLabel, PBDivider } from "./PlaybookShared";

const produtos = [
  {
    id: "navona",
    nome: "TRAVERTINO NAVONA",
    subtitulo: "Assinatura da Casa",
    origem: "Tivoli, Itália",
    tom: "Bege dourado com veios suaves e homogêneos",
    acabamento: "Filled & Honed (preenchido e polido fosco)",
    formatos: ["60×60 cm", "60×120 cm", "60×200 cm"],
    espessura: "2 cm",
    aplicacoes: ["Salas de estar premium", "Lobbies e recepções", "Halls de entrada", "Suítes master"],
    diferenciais: "Lote selecionado especialmente para a linha Navona — tonalidade mais uniforme, veios mais delicados. O produto mais exclusivo do portfólio.",
    argumento: "Quando o projeto precisa de algo que nenhum concorrente vai ter. A pedra que leva o nome da casa.",
    preco: "Consultar tabela comercial",
  },
  {
    id: "classico-light",
    nome: "TRAVERTINO CLÁSSICO LIGHT",
    subtitulo: "Luminosidade e Elegância",
    origem: "Tivoli, Itália",
    tom: "Bege claro, quase marfim — tonalidades frias e luminosas",
    acabamento: "Livre conforme lote — filled/unfilled, polido/escovado",
    formatos: ["60×60 cm", "60×120 cm", "60×200 cm"],
    espessura: "2 cm",
    aplicacoes: ["Ambientes com muita luz natural", "Cozinhas abertas", "Banheiros de alto padrão", "Fachadas contemporâneas"],
    diferenciais: "Tonalidade mais clara da linha — ideal para projetos que buscam leveza e amplitude visual sem abrir mão da naturalidade da pedra.",
    argumento: "Para o arquiteto que quer travertino sem o amarelado tradicional. A versão mais luminosa do clássico.",
    preco: "Consultar tabela comercial",
  },
  {
    id: "classico",
    nome: "TRAVERTINO CLÁSSICO",
    subtitulo: "O Original Romano",
    origem: "Tivoli, Itália",
    tom: "Bege tradicional — veios quentes e irregulares, caráter natural",
    acabamento: "Livre conforme lote",
    formatos: ["60×60 cm", "60×120 cm", "60×200 cm"],
    espessura: "2 cm",
    aplicacoes: ["Pisos internos e externos", "Fachadas residenciais e comerciais", "Revestimentos de paredes", "Piscinas e áreas molhadas"],
    diferenciais: "O travertino clássico que está nos grandes projetos do mundo há séculos. Versátil, robusto e inconfundível.",
    argumento: "O material que os grandes arquitetos usaram para sempre. Presente no Coliseu, no Getty Center, nas grandes obras do séc. XX.",
    preco: "Consultar tabela comercial",
  },
  {
    id: "red",
    nome: "TRAVERTINO RED",
    subtitulo: "Personalidade e Presença",
    origem: "Irã / Turquia",
    tom: "Terracota e bordo — veios escuros em fundo avermelhado",
    acabamento: "Livre conforme lote",
    formatos: ["60×60 cm", "60×120 cm"],
    espessura: "2 cm",
    aplicacoes: ["Accent walls", "Bancadas de destaque", "Banheiros autorais", "Projetos comerciais bold"],
    diferenciais: "O único travertino vermelho do portfólio. Para quem quer um ponto de distinção radical no projeto — difícil de encontrar com esta qualidade no Brasil.",
    argumento: "Quando o cliente quer que a parede seja a peça de arte. Uma cor que nenhum porcelanato replica.",
    preco: "Consultar tabela comercial",
  },
  {
    id: "chocolate",
    nome: "TRAVERTINO CHOCOLATE",
    subtitulo: "Sofisticação Contemporânea",
    origem: "Turquia / Europa",
    tom: "Marrom escuro com veios creme — contraste sofisticado",
    acabamento: "Livre conforme lote",
    formatos: ["60×60 cm", "60×120 cm"],
    espessura: "2 cm",
    aplicacoes: ["Projetos escandinavos e contemporâneos", "Home office premium", "Fachadas com pele única", "Interiores masculinos"],
    diferenciais: "O travertino mais escuro do portfólio — excelente para projetos contemporâneos que querem a textura natural da pedra em uma paleta sombria.",
    argumento: "Para o cliente que ama dark interiors mas não abre mão de material natural. A alternativa sofisticada ao quartzito preto.",
    preco: "Consultar tabela comercial",
  },
  {
    id: "silver",
    nome: "TRAVERTINO SILVER",
    subtitulo: "Modernidade Natural",
    origem: "Tivoli / Turquia",
    tom: "Cinza prateado com veios finos — textura neutra e moderna",
    acabamento: "Livre conforme lote",
    formatos: ["60×60 cm", "60×120 cm", "60×200 cm"],
    espessura: "2 cm",
    aplicacoes: ["Fachadas minimalistas", "Ambientes neutros e contemporâneos", "Pisos de grandes espaços", "Projetos corporativos"],
    diferenciais: "A resposta da natureza ao mármore cinza de engenharia. Com a textura real e imperfeição única da pedra natural, mas na paleta fria que o mercado contemporâneo pede.",
    argumento: "Para o arquiteto que usa muito Calacatta cinza ou Grigio — mas quer algo com mais alma e autenticidade.",
    preco: "Consultar tabela comercial",
  },
  {
    id: "chapa",
    nome: "TRAVERTINO EM CHAPA",
    subtitulo: "Para o Extraordinário",
    origem: "Tivoli, Itália",
    tom: "Variável — disponível em Clássico, Silver e Navona",
    acabamento: "Livre conforme lote",
    formatos: ["Chapas inteiras ~280×160 cm", "Corte sob medida disponível"],
    espessura: "2–3 cm",
    aplicacoes: ["Bancadas de cozinha e banheiro", "Tampos de mesa", "Painéis de marcenaria integrada", "Revestimentos especiais contínuos"],
    diferenciais: "A chapa inteira elimina emendas e cria continuidade visual impossível com formatos convencionais. Ideal para projetos de marcenaria de alto nível.",
    argumento: "Para o arquiteto que quer uma bancada de 3m sem emenda — ou um painel de travertino que parece ter saído de uma só pedra. Exclusivo no Brasil.",
    preco: "Consultar tabela comercial",
  },
];

const faq = [
  { pergunta: "O travertino precisa de tratamento?", resposta: "Sim. Recomendamos aplicação de impermeabilizante a cada 2–3 anos em pisos de alto tráfego. Em revestimentos verticais, a proteção é muito menor. O produto preenchido (filled) é mais resistente a manchas." },
  { pergunta: "O travertino funciona em área molhada?", resposta: "Sim — com tratamento adequado. Travertino polido pode ser escorregadio molhado; preferir acabamento escovado ou lapado em áreas de piscina e banheiro." },
  { pergunta: "Qual a diferença entre filled e unfilled?", resposta: "O travertino tem alvéolos naturais (buracos). O filled tem esses poros preenchidos com resina ou cimento — superfície mais lisa e uniforme. O unfilled mantém os poros abertos — estética mais rústica e natural." },
  { pergunta: "Como identificar um bom lote?", resposta: "Uniformidade de tonalidade, regularidade de espessura (variação máx. 1mm), sem fissuras visíveis. Nossa seleção na origem garante esses critérios." },
  { pergunta: "O travertino pode ser assentado igual ao porcelanato?", resposta: "Sim, desde que o contrapiso esteja pronto e nivelado. Argamassa colante AC-II ou AC-III. Juntas mínimas de 1,5mm. Rejunte com produto flexível." },
  { pergunta: "Qual a durabilidade do travertino?", resposta: "Séculos — literalmente. O Coliseu é parcialmente travertino. Com manutenção básica (limpeza neutra + impermeabilizante), o material não se degrada." },
];

export function PlaybookProduto({ onBack }: { onBack?: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const produto = produtos.find((p) => p.id === selected);

  return (
    <div style={{ backgroundColor: "#050505" }}>
      <PBModuleNav onBack={onBack} title="PLAYBOOK DE PRODUTO" />

      <div style={{ paddingTop: 64 }}>
        <PBHero
          label="LINHA COMPLETA · TRAVERTINO ROMANO"
          title={"PLAYBOOK DE\nPRODUTO"}
          sub="O guia técnico completo da linha Navona — especificações, aplicações, argumentação de venda e respostas para as perguntas mais frequentes."
        />

        {/* Sobre o travertino */}
        <PBWrap>
          <PBSectionHeader number="01" title="O QUE TODO TIME PRECISA SABER SOBRE TRAVERTINO" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }} className="max-md:grid-cols-1">
            <div>
              <PBLabel>A PEDRA</PBLabel>
              <PBBody>
                O travertino é uma rocha sedimentar calcária formada pela precipitação de carbonato de cálcio em fontes termais. Seus veios e alvéolos são registros geológicos únicos — nenhum travertino é igual ao outro.
              </PBBody>
              <div style={{ marginTop: 24 }}>
                <PBBody>
                  O travertino romano, extraído principalmente em Tivoli (próximo a Roma), é o mais nobre do mundo. Temperatura de formação e composição mineral única resultam em tonalidade, veios e resistência superiores.
                </PBBody>
              </div>
            </div>
            <div>
              <div style={{ position: "relative" }}>
                <img src={travertino} alt="Travertino Romano" style={{ width: "100%", height: 280, objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px", backgroundColor: "rgba(5,5,5,0.6)", display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.1em" }}>TRAVERTINO ROMANO</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: "#77736A", letterSpacing: "0.1em" }}>TIVOLI, ITÁLIA</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginTop: 48 }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
            {[
              { title: "FORMADO HÁ", stat: "+10.000", sub: "anos" },
              { title: "PRESENTE NO", stat: "COLISEU", sub: "de Roma" },
              { title: "DURABILIDADE", stat: "SÉCULOS", sub: "com manutenção básica" },
              { title: "LINHA NAVONA", stat: "7", sub: "produtos" },
            ].map((s) => (
              <div key={s.title} style={{ border: "1px solid rgba(5,5,5,0.07)", padding: "24px" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 8 }}>{s.title}</p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: "#050505", marginBottom: 4 }}>{s.stat}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "#77736A" }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </PBWrap>

        {/* Linha de produtos — seleção */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="02" title="LINHA COMPLETA — SELECIONE O PRODUTO" dark />
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 40 }}>
              {produtos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    padding: "10px 18px",
                    border: `1px solid ${selected === p.id ? "rgba(216,211,199,0.5)" : "rgba(216,211,199,0.1)"}`,
                    backgroundColor: selected === p.id ? "rgba(216,211,199,0.08)" : "transparent",
                    color: selected === p.id ? "#D8D3C7" : "#77736A",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {p.nome.replace("TRAVERTINO ", "")}
                </button>
              ))}
            </div>

            {produto ? (
              <div style={{ border: "1px solid rgba(216,211,199,0.12)", padding: "48px", backgroundColor: "rgba(216,211,199,0.02)", animation: "fadeIn 0.2s" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }} className="max-md:grid-cols-1">
                  <div>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.2em", color: "#77736A", marginBottom: 8 }}>{produto.subtitulo.toUpperCase()}</p>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 22, letterSpacing: "0.08em", color: "#D8D3C7", marginBottom: 32 }}>{produto.nome}</p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                      {[
                        { label: "ORIGEM", value: produto.origem },
                        { label: "TOM", value: produto.tom },
                        { label: "ACABAMENTO", value: produto.acabamento },
                        { label: "ESPESSURA", value: produto.espessura },
                      ].map((i) => (
                        <div key={i.label}>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 6 }}>{i.label}</p>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.65)", lineHeight: 1.5, fontWeight: 300 }}>{i.value}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 10 }}>FORMATOS DISPONÍVEIS</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {produto.formatos.map((f) => (
                          <span key={f} style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: "#77736A", border: "1px solid rgba(216,211,199,0.12)", padding: "4px 10px" }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ marginBottom: 28 }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 10 }}>APLICAÇÕES IDEAIS</p>
                      {produto.aplicacoes.map((a) => (
                        <div key={a} style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
                          <div style={{ width: 12, height: 1, backgroundColor: "rgba(216,211,199,0.25)", marginTop: 9, flexShrink: 0 }} />
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.55)", lineHeight: 1.5, fontWeight: 300 }}>{a}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 24, borderTop: "1px solid rgba(216,211,199,0.08)", paddingTop: 24 }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 8 }}>DIFERENCIAL</p>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(216,211,199,0.6)", lineHeight: 1.7, fontWeight: 300 }}>{produto.diferenciais}</p>
                    </div>

                    <div style={{ padding: "20px", border: "1px solid rgba(216,211,199,0.1)", backgroundColor: "rgba(216,211,199,0.03)" }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 8 }}>ARGUMENTO DE VENDA</p>
                      <p style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.06em", color: "#D8D3C7", lineHeight: 1.7, fontStyle: "italic" }}>"{produto.argumento}"</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ border: "1px solid rgba(216,211,199,0.08)", padding: "48px", textAlign: "center" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.3)", letterSpacing: "0.1em" }}>SELECIONE UM PRODUTO ACIMA PARA VER OS DETALHES</p>
              </div>
            )}
          </div>
        </section>

        {/* Tabela comparativa */}
        <PBWrap>
          <PBSectionHeader number="03" title="TABELA COMPARATIVA — LINHA COMPLETA" />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(5,5,5,0.15)" }}>
                  {["PRODUTO", "TOM", "FORMATOS", "ACABAMENTO", "INDICAÇÃO PRINCIPAL"].map((h) => (
                    <th key={h} style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", textAlign: "left", padding: "0 16px 12px 0", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produtos.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(5,5,5,0.06)", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(5,5,5,0.02)" }}>
                    <td style={{ padding: "20px 16px 20px 0" }}>
                      <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.08em", color: "#050505" }}>{p.nome}</p>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: "#77736A", marginTop: 2 }}>{p.subtitulo}</p>
                    </td>
                    <td style={{ padding: "20px 16px 20px 0" }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{p.tom.split(" ").slice(0, 4).join(" ")}</p>
                    </td>
                    <td style={{ padding: "20px 16px 20px 0" }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{p.formatos[0]}{p.formatos.length > 1 ? ` +${p.formatos.length - 1}` : ""}</p>
                    </td>
                    <td style={{ padding: "20px 16px 20px 0" }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{p.acabamento.split(" ").slice(0, 3).join(" ")}</p>
                    </td>
                    <td style={{ padding: "20px 16px 20px 0" }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#77736A", fontWeight: 300 }}>{p.aplicacoes[0]}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PBWrap>

        {/* Por ambiente */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="04" title="QUAL PRODUTO RECOMENDAR POR AMBIENTE" dark />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }} className="max-md:grid-cols-1">
              {[
                { ambiente: "SALA DE ESTAR", recomendados: ["Navona", "Clássico", "Silver"], dica: "Piso ou parede. Formato 60×120 ou 60×200 para ampliar visualmente." },
                { ambiente: "COZINHA ABERTA", recomendados: ["Clássico Light", "Navona", "Chocolate"], dica: "Bancada em chapa ou revestimento de parede. Preenchido para facilitar limpeza." },
                { ambiente: "BANHEIRO MASTER", recomendados: ["Navona", "Silver", "Red"], dica: "Aplicar escovado em piso (antiderrapante). Polido em paredes para reflexo luminoso." },
                { ambiente: "FACHADA", recomendados: ["Clássico", "Silver", "Clássico Light"], dica: "Espessura mínima 2cm. Tratar com impermeabilizante específico para exteriores." },
                { ambiente: "HOME OFFICE", recomendados: ["Chocolate", "Silver", "Navona"], dica: "Parede de destaque por trás da mesa. Textura transmite seriedade e requinte." },
                { ambiente: "ÁREA EXTERNA", recomendados: ["Clássico", "Silver"], dica: "Acabamento escovado ou lapado. Impermeabilizante obrigatório. Evitar polido." },
              ].map((a) => (
                <div key={a.ambiente} style={{ border: "1px solid rgba(216,211,199,0.1)", padding: "32px 28px" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.12em", color: "#D8D3C7", marginBottom: 16 }}>{a.ambiente}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.14em", color: "#77736A", marginBottom: 8 }}>RECOMENDADOS</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                    {a.recomendados.map((r) => (
                      <span key={r} style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: "#77736A", border: "1px solid rgba(216,211,199,0.15)", padding: "3px 8px" }}>{r}</span>
                    ))}
                  </div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(216,211,199,0.45)", lineHeight: 1.6, fontWeight: 300 }}>{a.dica}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <PBWrap id="pb-faq">
          <PBSectionHeader number="05" title="PERGUNTAS FREQUENTES — RESPOSTAS DO TIME" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {faq.map((f) => (
              <div key={f.pergunta} style={{ borderBottom: "1px solid rgba(5,5,5,0.07)", padding: "28px 0", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 32 }} className="max-md:grid-cols-1">
                <div>
                  <PBLabel>PERGUNTA</PBLabel>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.07em", color: "#050505", lineHeight: 1.5 }}>{f.pergunta}</p>
                </div>
                <div>
                  <PBLabel>RESPOSTA</PBLabel>
                  <PBSmall>{f.resposta}</PBSmall>
                </div>
              </div>
            ))}
          </div>
        </PBWrap>
      </div>
    </div>
  );
}
