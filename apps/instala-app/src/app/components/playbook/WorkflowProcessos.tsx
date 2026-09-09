import { PBModuleNav, PBHero, PBWrap, PBSectionHeader, PBBody, PBSmall, PBLabel } from "./PlaybookShared";

function FlowStep({
  n,
  title,
  desc,
  resp,
  dark = false,
  last = false,
}: {
  n: string;
  title: string;
  desc: string;
  resp: string;
  dark?: boolean;
  last?: boolean;
}) {
  const borderColor = dark ? "rgba(216,211,199,0.1)" : "rgba(5,5,5,0.08)";
  const numColor = dark ? "rgba(216,211,199,0.2)" : "rgba(5,5,5,0.15)";
  const titleColor = dark ? "#D8D3C7" : "#050505";
  const descColor = dark ? "rgba(216,211,199,0.55)" : "#77736A";
  const respColor = dark ? "rgba(216,211,199,0.3)" : "rgba(5,5,5,0.3)";
  const arrowColor = dark ? "rgba(216,211,199,0.2)" : "rgba(5,5,5,0.15)";

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 24 }}>
        <div style={{
          width: 32,
          height: 32,
          border: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: 8, letterSpacing: "0.1em", color: numColor }}>{n}</p>
        </div>
        {!last && (
          <div style={{ width: 1, flex: 1, minHeight: 32, backgroundColor: arrowColor, marginTop: 0 }} />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 32, flex: 1 }}>
        <p style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.1em", color: titleColor, marginBottom: 8 }}>{title}</p>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: descColor, lineHeight: 1.7, fontWeight: 300, marginBottom: 8 }}>{desc}</p>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: respColor }}>RESP: {resp}</p>
      </div>
    </div>
  );
}

function FlowBlock({ title, steps, dark = false }: { title: string; steps: { n: string; title: string; desc: string; resp: string }[]; dark?: boolean }) {
  return (
    <div style={{ border: `1px solid ${dark ? "rgba(216,211,199,0.1)" : "rgba(5,5,5,0.08)"}`, padding: "40px 32px" }}>
      <p style={{
        fontFamily: "'Cinzel', serif",
        fontSize: 9,
        letterSpacing: "0.2em",
        color: dark ? "rgba(216,211,199,0.3)" : "rgba(5,5,5,0.25)",
        marginBottom: 32,
      }}>
        {title}
      </p>
      {steps.map((s, i) => (
        <FlowStep key={s.n} {...s} dark={dark} last={i === steps.length - 1} />
      ))}
    </div>
  );
}

const funil = [
  { n: "01", title: "PROSPECÇÃO", desc: "BDR identifica e aborda leads via LinkedIn, Instagram, indicação e cold call. Meta: 50 contatos/semana.", resp: "BDR" },
  { n: "02", title: "PRIMEIRO CONTATO", desc: "Resposta ou agendamento de reunião. Lead entra no CRM como 'Prospect'.", resp: "BDR" },
  { n: "03", title: "QUALIFICAÇÃO BANT", desc: "SDR conduz conversa de descoberta. Valida Budget, Authority, Need, Timeline. Lead classificado como Qualificado ou Desqualificado.", resp: "SDR" },
  { n: "04", title: "REUNIÃO COMERCIAL", desc: "Closer apresenta Navona, produtos e proposta de valor. Demonstração com amostras físicas.", resp: "Closer" },
  { n: "05", title: "PROPOSTA FORMAL", desc: "Enviada em até 24h. Inclui especificação técnica, preço, prazo e condições. CRM atualizado.", resp: "Closer" },
  { n: "06", title: "NEGOCIAÇÃO", desc: "Alinhamento de condições, prazo de entrega, mix de produtos. Fechamento ou definição de data de decisão.", resp: "Closer" },
  { n: "07", title: "FECHAMENTO", desc: "Pedido formalizado. Contrato ou OC assinada. Cliente movido para 'Ativo' no CRM.", resp: "Closer" },
  { n: "08", title: "PÓS-VENDA", desc: "Acompanhamento de entrega, satisfação com material, abertura para próximo projeto.", resp: "Closer + Operações" },
];

const importacao = [
  { n: "01", title: "SELEÇÃO DE LOTE NA ITÁLIA", desc: "Visita técnica às pedreiras de Tivoli. Seleção visual e técnica de cada lote por cor, espessura e veios. Aprovação fotográfica.", resp: "Diretoria" },
  { n: "02", title: "CONTRATO E PAGAMENTO", desc: "Negociação com pedreira parceira. Pagamento parcial para reservar lote. Emissão de invoice e packing list.", resp: "Financeiro + Diretoria" },
  { n: "03", title: "EMBARQUE E DOCUMENTAÇÃO", desc: "Agenciamento de carga. Documentos: BL, certificado de origem, invoice comercial. Transporte por container de 20 ou 40 pés.", resp: "Operações + Despachante" },
  { n: "04", title: "DESPACHO ADUANEIRO", desc: "Entrada no Recinto Alfandegado. Pagamento de II, IPI, PIS/COFINS, ICMS. Liberação documental e física.", resp: "Despachante Aduaneiro" },
  { n: "05", title: "TRANSPORTE ATÉ ARMAZÉM SP", desc: "Carga do porto (Santos ou Vitória) até o armazém em São Paulo. Conferência de qualidade na descarga.", resp: "Operações + Logística" },
  { n: "06", title: "ENTRADA EM ESTOQUE", desc: "Registro no sistema. Separação por lote e tipo. Fotos de cada pallet. Disponível para pronta entrega.", resp: "Operações" },
];

const entrega = [
  { n: "01", title: "PEDIDO APROVADO", desc: "OC ou contrato assinado recebido. Entrada no sistema de pedidos. Verificação de estoque disponível.", resp: "Operações" },
  { n: "02", title: "SEPARAÇÃO", desc: "Seleção do lote correto. Conferência de quantidade e qualidade. Embalagem para transporte (proteção de cantos e face).", resp: "Estoque" },
  { n: "03", title: "NOTA FISCAL", desc: "Emissão de NF-e. Conferência de CFOP, ICMS ST e dados do cliente. Envio ao cliente para conferência antes do embarque.", resp: "Fiscal/Financeiro" },
  { n: "04", title: "AGENDAMENTO DE ENTREGA", desc: "Alinhamento com cliente e transportadora. Definição de janela de entrega. Contato com responsável na obra.", resp: "Operações" },
  { n: "05", title: "TRANSPORTE", desc: "Saída do armazém. Foto do carregamento. Tracking compartilhado com cliente. Tempo médio: 1–3 dias úteis em SP.", resp: "Logística" },
  { n: "06", title: "RECEBIMENTO E CONFIRMAÇÃO", desc: "Cliente confirma recebimento e integridade. Registro de entrega no CRM. Abertura de ticket se houver avaria.", resp: "Closer + Operações" },
];

const crm = [
  { status: "PROSPECT", desc: "Lead abordado pelo BDR. Ainda sem qualificação.", cor: "rgba(5,5,5,0.08)" },
  { status: "QUALIFICADO", desc: "BANT validado pelo SDR. Apto para reunião com Closer.", cor: "rgba(5,5,5,0.12)" },
  { status: "EM PROPOSTA", desc: "Reunião realizada. Proposta enviada. Aguardando decisão.", cor: "rgba(5,5,5,0.16)" },
  { status: "NEGOCIAÇÃO", desc: "Proposta recebida. Em ajuste de condições.", cor: "rgba(5,5,5,0.2)" },
  { status: "FECHADO — GANHO", desc: "Pedido confirmado. Cliente ativo.", cor: "#050505" },
  { status: "FECHADO — PERDIDO", desc: "Oportunidade não convertida. Motivo registrado.", cor: "#77736A" },
];

export function WorkflowProcessos({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{ backgroundColor: "#050505" }}>
      <PBModuleNav onBack={onBack} title="WORKFLOW DE PROCESSOS" />

      <div style={{ paddingTop: 64 }}>
        <PBHero
          label="OPERAÇÕES"
          title={"WORKFLOW DE\nPROCESSOS"}
          sub="Os fluxos operacionais da Navona — do primeiro contato comercial à entrega em obra, passando pela importação e logística."
        />

        {/* Funil de Vendas */}
        <PBWrap id="wf-funil">
          <PBSectionHeader number="01" title="FUNIL DE VENDAS — PASSO A PASSO" />
          <PBBody>
            Cada etapa tem um responsável claro e um critério de entrada. Nada avança sem o critério anterior cumprido.
          </PBBody>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginTop: 48 }} className="max-md:grid-cols-1">
            <FlowBlock
              title="GERAÇÃO E QUALIFICAÇÃO"
              steps={funil.slice(0, 4)}
            />
            <FlowBlock
              title="PROPOSTA E FECHAMENTO"
              steps={funil.slice(4)}
            />
          </div>

          {/* Resumo visual */}
          <div style={{ marginTop: 48, display: "flex", gap: 2, overflowX: "auto", paddingBottom: 8 }}>
            {["PROSPECÇÃO", "QUALIFICAÇÃO", "REUNIÃO", "PROPOSTA", "NEGOCIAÇÃO", "FECHAMENTO", "PÓS-VENDA"].map((s, i, arr) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <div style={{
                  padding: "10px 16px",
                  backgroundColor: i === arr.length - 1 ? "#050505" : `rgba(5,5,5,${0.04 + i * 0.03})`,
                  border: "1px solid rgba(5,5,5,0.08)",
                  whiteSpace: "nowrap",
                }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.14em", color: i === arr.length - 1 ? "#D8D3C7" : "#77736A" }}>
                    {s}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <p style={{ fontSize: 10, color: "rgba(5,5,5,0.2)", flexShrink: 0 }}>›</p>
                )}
              </div>
            ))}
          </div>
        </PBWrap>

        {/* Importação */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="02" title="PROCESSO DE IMPORTAÇÃO" dark />
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "rgba(216,211,199,0.65)", lineHeight: 1.9, fontWeight: 300, marginBottom: 48, maxWidth: 600 }}>
              Da pedreira italiana ao armazém em São Paulo. Tempo médio total: 60–90 dias.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }} className="max-md:grid-cols-1">
              <FlowBlock title="ORIGEM — ITÁLIA" steps={importacao.slice(0, 3)} dark />
              <FlowBlock title="DESTINO — BRASIL" steps={importacao.slice(3)} dark />
            </div>

            {/* Tempo médio */}
            <div style={{ marginTop: 48, border: "1px solid rgba(216,211,199,0.1)", padding: "32px" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.2em", color: "rgba(216,211,199,0.3)", marginBottom: 24 }}>TEMPOS MÉDIOS DE PROCESSO</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }} className="max-md:grid-cols-2">
                {[
                  { fase: "Seleção + Contrato", tempo: "7–14 dias" },
                  { fase: "Embarque + Trânsito", tempo: "25–35 dias" },
                  { fase: "Despacho Aduaneiro", tempo: "10–20 dias" },
                  { fase: "Transporte até SP", tempo: "2–5 dias" },
                ].map((t) => (
                  <div key={t.fase}>
                    <p style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: "#D8D3C7", marginBottom: 4 }}>{t.tempo}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#77736A" }}>{t.fase}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Entrega */}
        <PBWrap id="wf-entrega">
          <PBSectionHeader number="03" title="PROCESSO DE ENTREGA" />
          <PBBody>
            Do pedido aprovado à confirmação na obra. O cliente deve sentir segurança em cada etapa.
          </PBBody>
          <div style={{ marginTop: 48 }}>
            <FlowBlock title="FLUXO DE ENTREGA" steps={entrega} />
          </div>

          {/* SLA */}
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }} className="max-md:grid-cols-1">
            {[
              { titulo: "PRONTA ENTREGA SP", sla: "2–5 dias úteis", obs: "Para pedidos com estoque disponível em nosso armazém SP." },
              { titulo: "ENTREGA OUTRAS CIDADES", sla: "5–10 dias úteis", obs: "Dependente de frete e transportadora parceira." },
              { titulo: "PEDIDO SOB ENCOMENDA", sla: "60–90 dias", obs: "Para lotes específicos importados sob demanda." },
            ].map((s) => (
              <div key={s.titulo} style={{ border: "1px solid rgba(5,5,5,0.08)", padding: "24px" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 8 }}>{s.titulo}</p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: "#050505", marginBottom: 8 }}>{s.sla}</p>
                <PBSmall>{s.obs}</PBSmall>
              </div>
            ))}
          </div>
        </PBWrap>

        {/* CRM */}
        <section style={{ backgroundColor: "#050505", padding: "100px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 72px" }}>
            <PBSectionHeader number="04" title="GESTÃO NO CRM" dark />
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "rgba(216,211,199,0.65)", lineHeight: 1.9, fontWeight: 300, marginBottom: 48, maxWidth: 600 }}>
              O CRM é o coração do time comercial. Toda interação deve ser registrada. Um lead sem CRM é um lead perdido.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {crm.map((s) => (
                <div key={s.status} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 24, borderBottom: "1px solid rgba(216,211,199,0.06)", padding: "20px 0", alignItems: "center" }} className="max-sm:grid-cols-1">
                  <div style={{
                    padding: "8px 16px",
                    backgroundColor: s.cor,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.14em", color: s.status.includes("GANHO") ? "#D8D3C7" : "#77736A", whiteSpace: "nowrap" }}>{s.status}</p>
                  </div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.5)", lineHeight: 1.6, fontWeight: 300 }}>{s.desc}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 48, border: "1px solid rgba(216,211,199,0.1)", padding: "32px" }}>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "0.2em", color: "rgba(216,211,199,0.3)", marginBottom: 16 }}>REGRAS DE ATUALIZAÇÃO</p>
              {["Atualizar status do lead em até 2h após qualquer interação", "Registrar todas as interações: e-mail, ligação, reunião, WhatsApp", "Adicionar nota qualitativa após cada reunião comercial", "CRM zerado é disciplina — quem não registra, não prioriza"].map((r) => (
                <div key={r} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 16, height: 1, backgroundColor: "rgba(216,211,199,0.2)", marginTop: 9, flexShrink: 0 }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(216,211,199,0.5)", lineHeight: 1.6, fontWeight: 300 }}>{r}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pós-venda */}
        <PBWrap id="wf-posvenda">
          <PBSectionHeader number="05" title="PROCESSO DE PÓS-VENDA" />
          <PBBody>
            O pós-venda é onde os melhores clientes são construídos. Um arquiteto satisfeito traz o próximo projeto — e indica a Navona para os colegas.
          </PBBody>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: 48 }} className="max-md:grid-cols-1">
            {[
              { prazo: "48H APÓS ENTREGA", acao: "Confirmar recebimento e qualidade com o responsável técnico na obra." },
              { prazo: "15 DIAS APÓS ENTREGA", acao: "Check-in: material aplicado? Alguma dúvida técnica? Foto da obra para nosso portfólio?" },
              { prazo: "30 DIAS", acao: "Solicitar depoimento ou indicação. Apresentar novidades de produto." },
              { prazo: "90 DIAS", acao: "Prospectar próximo projeto. 'Em que estás trabalhando atualmente?'" },
              { prazo: "ANUALMENTE", acao: "Visita presencial ou presente simbólico nos melhores clientes. Relacionamento de longo prazo." },
              { prazo: "SEMPRE", acao: "Engajar no conteúdo do cliente nas redes. Comentar projetos. Mostrar que nos importamos além da venda." },
            ].map((p) => (
              <div key={p.prazo} style={{ border: "1px solid rgba(5,5,5,0.07)", padding: "28px 24px" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, letterSpacing: "0.16em", color: "#77736A", marginBottom: 12 }}>{p.prazo}</p>
                <PBSmall>{p.acao}</PBSmall>
              </div>
            ))}
          </div>
        </PBWrap>
      </div>
    </div>
  );
}
