import { useState } from "react";
import { PBModuleNav, PBHero, PBWrap, PBSectionHeader, PBBody, PBSmall, PBLabel, PBDivider, PBCard, PBTag } from "./PlaybookShared";

const icp = [
  { perfil: "ARQUITETOS E DESIGNERS", desc: "Responsáveis por especificar materiais em projetos residenciais e comerciais de alto padrão. Valorizam exclusividade, consistência visual e parceria técnica.", ticket: "Alto", ciclo: "30–90 dias", canal: "Instagram, indicação, feira" },
  { perfil: "INCORPORADORAS", desc: "Buscam fornecimento consistente em escala para múltiplos empreendimentos. Decisão envolve engenharia e diretoria. Alto volume, contratos recorrentes.", ticket: "Muito alto", ciclo: "60–180 dias", canal: "Prospecção ativa, LinkedIn" },
  { perfil: "CONSTRUTORAS DE ALTO PADRÃO", desc: "Precisam de estoque garantido e prazo de entrega confiável. Sensíveis a atraso. Relacionamento é tudo.", ticket: "Alto", ciclo: "45–90 dias", canal: "Indicação, visita técnica" },
  { perfil: "SHOWROOMS E REVENDEDORES", desc: "Querem exclusividade de linha em sua região e margem competitiva. Canal estratégico para ampliar presença.", ticket: "Médio-alto", ciclo: "30–60 dias", canal: "Prospecção ativa, feiras" },
];

const funil = [
  { role: "BDR", label: "Business Development Rep", cor: "#D8D3C7", desc: "Prospecção e geração de oportunidades. Identifica, aborda e agenda reuniões para o SDR." },
  { role: "SDR", label: "Sales Development Rep", cor: "#77736A", desc: "Qualifica os leads gerados pelo BDR. Garante que só chegue ao Closer quem tem real potencial." },
  { role: "CLOSER", label: "Executivo de Vendas", cor: "#050505", desc: "Conduz apresentação, proposta, negociação e fechamento. Responsável pela receita." },
];

const bdrCadencia = [
  { dia: "DIA 1", acao: "Conexão no LinkedIn com mensagem personalizada + follow no Instagram." },
  { dia: "DIA 3", acao: "Comentário relevante em post recente (não comercial). Mostra que você acompanha." },
  { dia: "5", acao: "Direct/DM no Instagram ou mensagem LinkedIn com gancho de valor (ex: case, novidade de produto)." },
  { dia: "8", acao: "E-mail formal apresentando a Navona e solicitando 15 minutos de conversa." },
  { dia: "12", acao: "Ligação direta. Objetivo: confirmar recebimento e agendar reunião." },
  { dia: "17", acao: "Último toque: WhatsApp com conteúdo visual (foto do material, projeto referência)." },
];

const scripts = [
  {
    titulo: "SCRIPT — ABORDAGEM LINKEDIN (BDR)",
    conteudo: `"Olá, [nome]. Acompanho seu trabalho e me impressiona a qualidade dos projetos que você entrega.

Trabalho com a Navona — importamos travertino romano diretamente da Itália, com estoque permanente em São Paulo.

Achei que poderia ser relevante para os materiais que você especifica. Posso compartilhar nosso portfólio?"`,
  },
  {
    titulo: "SCRIPT — COLD CALL (BDR)",
    conteudo: `"Bom dia, [nome]! Aqui é [seu nome], da Navona. Temos 30 segundos?

Somos importadores diretos de travertino romano — estoque aqui em SP, pronta entrega. Trabalhamos com arquitetos e incorporadoras em projetos de alto padrão.

Vi que você trabalha com [referência do projeto/estilo]. Acredito que nosso material encaixaria bem.

Você tem 15 minutos esta semana para conhecer nossa linha?"`,
  },
  {
    titulo: "SCRIPT — WHATSAPP (BDR)",
    conteudo: `"Olá, [nome]! Tudo bem?

[Nome] aqui da Navona — travertino romano importado da Itália.

Estou te enviando algumas referências de projetos que usaram nossa linha [Clássico / Silver / Chapa]. Acho que vai te interessar.

Você toparia uma conversa rápida essa semana? 15 minutinhos."`,
  },
];

const qualificacao = [
  { letra: "B", palavra: "BUDGET", pergunta: "Qual o budget estimado para o material deste projeto? Ou: quais materiais vocês usualmente especificam neste nível de acabamento?" },
  { letra: "A", palavra: "AUTHORITY", pergunta: "Quem mais está envolvido na decisão de fornecedores? Você costuma especificar direto ou precisa de aprovação do cliente?" },
  { letra: "N", palavra: "NEED", pergunta: "Qual é o maior desafio que vocês enfrentam com pedras naturais hoje? (prazo, consistência de lote, preço?)" },
  { letra: "T", palavra: "TIMELINE", pergunta: "Quando começa a especificação deste projeto? Qual o prazo de entrega do material em obra?" },
];

const objecoes = [
  {
    objecao: '"É caro."',
    resposta: 'Entendo. O travertino é uma pedra natural importada da Itália — a relação custo × benefício ao longo de décadas é muito superior a qualquer alternativa industrial. Posso mostrar uma comparação de m² amortizado em 20 anos?',
  },
  {
    objecao: '"Já trabalho com outro fornecedor."',
    resposta: 'Ótimo, isso significa que você valoriza material de qualidade. Nosso diferencial é estoque permanente em SP e seleção de lote na origem. Muitos arquitetos nos usam como segunda fonte para garantir consistência. Posso te mostrar o material?',
  },
  {
    objecao: '"Preciso de prazo menor."',
    resposta: 'Temos estoque permanente em São Paulo — pronta entrega na maioria das linhas. Qual é a sua data de obra? Posso confirmar disponibilidade agora.',
  },
  {
    objecao: '"Prefiro porcelanato."',
    resposta: 'Faz sentido para muitos projetos. Quando seu cliente pede algo diferenciado — algo que nenhum vizinho vai ter — o travertino é insubstituível. Posso te mostrar como ele aparece em projetos residenciais contemporâneos?',
  },
  {
    objecao: '"Não conheço a Navona."',
    resposta: 'Justamente por isso quero te apresentar. Somos novos no mercado brasileiro mas nosso time importa diretamente da Itália há anos. Posso te enviar amostras e referências de projetos?',
  },
];

const kpis = [
  { papel: "BDR", metricas: ["50 contatos/semana", "Taxa de resposta ≥ 15%", "8 reuniões agendadas/semana", "Cadência de 6 toques por lead"] },
  { papel: "SDR", metricas: ["Taxa de qualificação ≥ 60%", "10 leads qualificados/semana", "Ciclo de qualificação ≤ 3 dias", "Passagem para Closer com BANT completo"] },
  { papel: "CLOSER", metricas: ["Taxa de fechamento ≥ 25%", "Ticket médio: R$ 35.000", "Ciclo de venda: 30–60 dias", "1 follow-up em ≤ 48h após reunião"] },
];

export function PlaybookAtendimento({ onBack }: { onBack?: () => void }) {
  const [activeScript, setActiveScript] = useState(0);

  return (
    <div style={{ backgroundColor: "#050505" }}>
      <PBModuleNav onBack={onBack} title="PLAYBOOK DE ATENDIMENTO" />

      <div style={{ paddingTop: 64 }}>
        <PBHero
          label="BDR · SDR · CLOSER"
          title={"PLAYBOOK DE\nATENDIMENTO"}
          sub="Da prospecção ao fechamento — o guia completo para o time comercial da Navona. Scripts, cadências, qualificação e gestão de objeções."
        />

        {/* ICP */}
        <PBWrap id="pb-icp">
          <PBSectionHeader number="01" title="PERFIL DO CLIENTE IDEAL — ICP" />
          <PBBody>
            Não tentamos vender para todo mundo. O tempo do time comercial é o ativo mais valioso. Conheça os quatro perfis que geram resultado para a Navona.
          </PBBody>
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 2 }}>
            {icp.map((p) => (
              <div key={p.perfil} style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 0.8fr 0.8fr 1fr", gap: 24, borderBottom: "1px solid rgba(5,5,5,0.08)", padding: "28px 0", alignItems: "start" }} className="max-lg:grid-cols-1">
                <div>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.12em", color: "#050505", marginBottom: 4 }}>{p.perfil}</p>
                </div>
                <PBSmall>{p.desc}</PBSmall>
                <div>
                  <PBLabel>TICKET</PBLabel>
                  <PBSmall>{p.ticket}</PBSmall>
                </div>
                <div>
                  <PBLabel>CICLO</PBLabel>
                  <PBSmall>{p.ciclo}</PBSmall>
                </div>
                <div>
                  <PBLabel>CANAL</PBLabel>
                  <PBSmall>{p.canal}</PBSmall>
                </div>
              </div>
            ))}
          </div>
        </PBWrap>

        {/* Funil */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="02" title="FUNIL COMERCIAL E PAPÉIS" dark />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }} className="max-md:grid-cols-1">
              {funil.map((f, i) => (
                <div key={f.role} style={{
                  padding: "40px 32px",
                  border: "1px solid rgba(216,211,199,0.1)",
                  backgroundColor: i === 2 ? "rgba(216,211,199,0.05)" : "transparent",
                }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.2em", color: "#77736A", marginBottom: 16 }}>PAPEL {String(i + 1).padStart(2, "0")}</p>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 20, letterSpacing: "0.1em", color: "#D8D3C7", marginBottom: 8 }}>{f.role}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#77736A", marginBottom: 24 }}>{f.label}</p>
                  <div style={{ width: "100%", height: 1, backgroundColor: "rgba(216,211,199,0.08)", marginBottom: 24 }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(216,211,199,0.65)", lineHeight: 1.8, fontWeight: 300 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BDR */}
        <PBWrap id="pb-bdr">
          <PBSectionHeader number="03" title="GUIA DO BDR — PROSPECÇÃO" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }} className="max-md:grid-cols-1">
            <div>
              <PBLabel>OBJETIVO DO BDR</PBLabel>
              <PBBody>Gerar oportunidades qualificadas para o SDR. O BDR não fecha — o BDR ABRE portas. Seu sucesso é medido em reuniões agendadas, não em vendas.</PBBody>
              <div style={{ marginTop: 32 }}>
                <PBLabel>FONTES DE PROSPECÇÃO</PBLabel>
                {["Instagram (busca por hashtags: #arquitetura, #decoração, #altopado)", "LinkedIn Sales Navigator (cargo: Arquiteto, Designer de Interiores)", "Indicações do Closer e clientes ativos", "Visitantes de feiras: Casa Cor, FIMMA, MixBrasil", "Google Maps: escritórios de arquitetura premium"].map((f) => (
                  <div key={f} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 4, height: 4, backgroundColor: "#77736A", borderRadius: "50%", marginTop: 7, flexShrink: 0 }} />
                    <PBSmall>{f}</PBSmall>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <PBLabel>CADÊNCIA DE 6 TOQUES</PBLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {bdrCadencia.map((c) => (
                  <div key={c.dia} style={{ display: "flex", gap: 20, borderBottom: "1px solid rgba(5,5,5,0.06)", padding: "18px 0", alignItems: "flex-start" }}>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.14em", color: "rgba(5,5,5,0.35)", minWidth: 32 }}>{c.dia}</p>
                    <PBSmall>{c.acao}</PBSmall>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PBWrap>

        {/* Scripts */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="04" title="SCRIPTS DE ABORDAGEM" dark />
            <div style={{ display: "flex", gap: 4, marginBottom: 40, flexWrap: "wrap" }}>
              {scripts.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveScript(i)}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    padding: "10px 20px",
                    border: `1px solid ${activeScript === i ? "rgba(216,211,199,0.4)" : "rgba(216,211,199,0.1)"}`,
                    backgroundColor: activeScript === i ? "rgba(216,211,199,0.07)" : "transparent",
                    color: activeScript === i ? "#D8D3C7" : "#77736A",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {s.titulo.split("—")[1].trim()}
                </button>
              ))}
            </div>
            <div style={{ border: "1px solid rgba(216,211,199,0.12)", padding: "40px", backgroundColor: "rgba(216,211,199,0.02)" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.18em", color: "rgba(216,211,199,0.4)", marginBottom: 24 }}>
                {scripts[activeScript].titulo}
              </p>
              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                color: "rgba(216,211,199,0.75)",
                lineHeight: 2,
                fontWeight: 300,
                whiteSpace: "pre-line",
              }}>
                {scripts[activeScript].conteudo}
              </p>
            </div>
          </div>
        </section>

        {/* SDR Qualificação */}
        <PBWrap id="pb-sdr">
          <PBSectionHeader number="05" title="GUIA DO SDR — QUALIFICAÇÃO BANT" />
          <PBBody>
            O SDR qualifica cada lead antes de passar ao Closer. Use o framework BANT como guia de conversa — nunca como interrogatório. O objetivo é entender se existe oportunidade real.
          </PBBody>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, marginTop: 48 }} className="max-md:grid-cols-2 max-sm:grid-cols-1">
            {qualificacao.map((q) => (
              <div key={q.letra} style={{ border: "1px solid rgba(5,5,5,0.08)", padding: "32px 24px" }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 32, color: "rgba(5,5,5,0.08)", marginBottom: 8 }}>{q.letra}</p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.16em", color: "#050505", marginBottom: 16 }}>{q.palavra}</p>
                <PBSmall>{q.pergunta}</PBSmall>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48, padding: "32px", backgroundColor: "rgba(5,5,5,0.03)", border: "1px solid rgba(5,5,5,0.06)" }}>
            <PBLabel>LEAD QUALIFICADO — CRITÉRIOS DE PASSAGEM</PBLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="max-sm:grid-cols-1">
              {["Budget confirmado ou indicado (acima de R$ 10k em material)", "Decisor identificado ou mapeado", "Necessidade clara e relevante para travertino", "Timeline definido: obra em até 90 dias"].map((c) => (
                <div key={c} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 16, height: 1, backgroundColor: "#050505", marginTop: 9, flexShrink: 0 }} />
                  <PBSmall>{c}</PBSmall>
                </div>
              ))}
            </div>
          </div>
        </PBWrap>

        {/* Closer */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="06" title="GUIA DO CLOSER — FECHAMENTO" dark />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }} className="max-md:grid-cols-1">
              <div>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.18em", color: "rgba(216,211,199,0.4)", marginBottom: 20 }}>FLUXO DA REUNIÃO</p>
                {[
                  { n: "01", titulo: "Rapport (5 min)", desc: "Conheça o projeto do cliente. Pergunte sobre o estilo, o desafio, os materiais que ele ama." },
                  { n: "02", titulo: "Apresentação Navona (5 min)", desc: "Origem italiana, estoque em SP, seleção de lote. Mostre o deck de forma objetiva." },
                  { n: "03", titulo: "Apresentação dos produtos (15 min)", desc: "Mostre amostras físicas. Narre cada tipo — tom, aplicação, diferenciais. Deixe o cliente tocar." },
                  { n: "04", titulo: "Descoberta aprofundada (10 min)", desc: "Quais áreas? Qual m²? Prazo de obra? Quem decide? Já especificou algum material?" },
                  { n: "05", titulo: "Proposta e negociação (10 min)", desc: "Apresente proposta no dia ou em até 24h. Defenda o preço com durabilidade, origem, exclusividade." },
                  { n: "06", titulo: "Próximo passo (5 min)", desc: "Sempre saio com uma data. Ex: 'Posso te enviar a proposta amanhã às 10h e ligamos para alinhar na sexta?'" },
                ].map((p) => (
                  <div key={p.n} style={{ display: "flex", gap: 20, borderBottom: "1px solid rgba(216,211,199,0.06)", padding: "20px 0" }}>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: "rgba(216,211,199,0.2)", minWidth: 24 }}>{p.n}</p>
                    <div>
                      <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.1em", color: "#D8D3C7", marginBottom: 6 }}>{p.titulo}</p>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.55)", lineHeight: 1.8, fontWeight: 300 }}>{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.18em", color: "rgba(216,211,199,0.4)", marginBottom: 20 }}>FOLLOW-UP PÓS-REUNIÃO</p>
                {[
                  { prazo: "≤ 2h", acao: "E-mail de agradecimento + PDF do deck + fotos dos produtos mostrados" },
                  { prazo: "24h", acao: "Proposta comercial formal enviada (nunca mais de 24h)" },
                  { prazo: "3 dias", acao: "WhatsApp: confirmação de recebimento e abertura de dúvidas" },
                  { prazo: "7 dias", acao: "Ligação: 'Como está o andamento do projeto? Posso ajudar com mais referências?'" },
                  { prazo: "15 dias", acao: "Conteúdo de valor: case de projeto, foto de obra usando o material indicado" },
                  { prazo: "30 dias", acao: "Check-in: projeto ainda ativo? Nova proposta se necessário" },
                ].map((f) => (
                  <div key={f.prazo} style={{ display: "flex", gap: 20, borderBottom: "1px solid rgba(216,211,199,0.06)", padding: "18px 0", alignItems: "flex-start" }}>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.1em", color: "rgba(216,211,199,0.35)", minWidth: 40 }}>{f.prazo}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.55)", lineHeight: 1.7, fontWeight: 300 }}>{f.acao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Objeções */}
        <PBWrap id="pb-objecoes">
          <PBSectionHeader number="07" title="GESTÃO DE OBJEÇÕES" />
          <PBBody>Uma objeção não é um não. É um pedido de mais informação. Mantenha a calma, valide o ponto do cliente e reframe com benefício concreto.</PBBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 48 }}>
            {objecoes.map((o) => (
              <div key={o.objecao} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32, borderBottom: "1px solid rgba(5,5,5,0.07)", padding: "28px 0" }} className="max-md:grid-cols-1">
                <div>
                  <PBLabel>OBJEÇÃO</PBLabel>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.08em", color: "#050505", lineHeight: 1.5 }}>{o.objecao}</p>
                </div>
                <div>
                  <PBLabel>RESPOSTA RECOMENDADA</PBLabel>
                  <PBSmall>{o.resposta}</PBSmall>
                </div>
              </div>
            ))}
          </div>
        </PBWrap>

        {/* KPIs */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="08" title="METAS E KPIs POR PAPEL" dark />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }} className="max-md:grid-cols-1">
              {kpis.map((k) => (
                <div key={k.papel} style={{ border: "1px solid rgba(216,211,199,0.1)", padding: "40px 32px" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: "0.1em", color: "#D8D3C7", marginBottom: 32 }}>{k.papel}</p>
                  {k.metricas.map((m) => (
                    <div key={m} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
                      <div style={{ width: 16, height: 1, backgroundColor: "rgba(216,211,199,0.3)", marginTop: 9, flexShrink: 0 }} />
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.6)", lineHeight: 1.6, fontWeight: 300 }}>{m}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 48, padding: "32px", border: "1px solid rgba(216,211,199,0.08)", backgroundColor: "rgba(216,211,199,0.02)" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.2em", color: "rgba(216,211,199,0.35)", marginBottom: 16 }}>REUNIÃO DE PIPELINE — SEMANAL</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(216,211,199,0.55)", lineHeight: 1.8, fontWeight: 300 }}>
                Toda segunda-feira, 9h: BDR apresenta prospecções da semana → SDR apresenta leads qualificados → Closer atualiza pipeline e fecha previsão de receita. Máximo 30 minutos. CRM atualizado antes da reunião.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
