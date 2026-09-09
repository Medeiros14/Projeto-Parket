import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, RotateCcw, Check } from "lucide-react";
import { sb } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";

/** Renderiza o TERMO/CONTRATO DE PRESTAÇÃO DE SERVIÇOS PARKET completo em tela
 *  (modelo do commit 01b516e). O prestador rola o documento inteiro, preenche
 *  os campos DAS PARTES, tira a foto (dentro do doc) e assina no canvas
 *  embutido na cláusula 14 — igual assinar um documento real. */

const FONT_DISPLAY = "'Cinzel', serif";
const FONT_BODY = "'Inter', sans-serif";
const API_URL = "https://gestao.parket.works";

type SnapshotItem = {
  codigo?: string;
  ambiente?: string;
  quantidade?: number;
  unidade?: string;
  descritivo?: string;
  categoria_raiz?: string;
  produto_header?: string;
};

type Termo = {
  id: string;
  equipe_id: string;
  card_id: string;
  status: "pendente" | "aceito" | "recusado" | "cancelado";
  itens_snapshot: SnapshotItem[];
  dados_prestador: Record<string, any>;
  pdf_url: string | null;
};

type ObraInfo = { cliente: string | null; endereco: string | null; obra_code: string | null };

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Agrupa itens por (categoria_raiz + produto_header) — vira ITEM 1.0, 2.0... */
function agruparPorSecao(itens: SnapshotItem[]) {
  const map = new Map<string, SnapshotItem[]>();
  for (const it of itens) {
    const raiz = (it.categoria_raiz || "OUTROS").toUpperCase();
    const produto = (it.produto_header || raiz).toUpperCase();
    const chave = `${raiz}|${produto}`;
    (map.get(chave) || map.set(chave, []).get(chave)!).push(it);
  }
  return Array.from(map.entries()).map(([k, arr], idx) => {
    const [, produto] = k.split("|");
    return { codigo: `${idx + 1}.0`, titulo: produto, itens: arr, unidade: arr[0]?.unidade || "m²" };
  });
}

export function AceitarTermo() {
  const { termoId } = useParams<{ termoId: string }>();
  const { prestador } = useAuth();
  const { T } = useTheme();
  const nav = useNavigate();
  const [termo, setTermo] = useState<Termo | null>(null);
  const [obra, setObra] = useState<ObraInfo | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desenhandoRef = useRef(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  useEffect(() => {
    if (!termoId) return;
    (async () => {
      const { data } = await sb.from("prestador_termos")
        .select("id,equipe_id,card_id,status,itens_snapshot,dados_prestador,pdf_url")
        .eq("id", termoId).maybeSingle();
      if (data) {
        setTermo(data as any);
        const d = (data as any).dados_prestador || {};
        setNome(d.nome || prestador?.nome || "");
        setCnpj(d.cnpj_cpf || "");
        setEndereco(d.endereco || "");
        if ((data as any).card_id) {
          const { data: card } = await sb.from("kanban_cards")
            .select("title,obra,details").eq("id", (data as any).card_id).maybeSingle();
          if (card) setObra({
            cliente: (card as any).title,
            obra_code: (card as any).obra,
            endereco: (card as any).details?.endereco_obra || (card as any).details?.endereco || null,
          });
        }
      }
    })();
  }, [termoId, prestador?.nome]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  }, [termo]);

  function posDoEvento(ev: React.PointerEvent) {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (cv.width / r.width),
              y: (ev.clientY - r.top) * (cv.height / r.height) };
  }
  function comecarDesenho(ev: React.PointerEvent<HTMLCanvasElement>) {
    ev.preventDefault(); desenhandoRef.current = true;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const { x, y } = posDoEvento(ev);
    ctx.beginPath(); ctx.moveTo(x, y);
  }
  function moverDesenho(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhandoRef.current) return;
    ev.preventDefault();
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const { x, y } = posDoEvento(ev);
    ctx.lineTo(x, y); ctx.stroke();
    if (!temAssinatura) setTemAssinatura(true);
  }
  function pararDesenho() { desenhandoRef.current = false; }
  function limparAssinatura() {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    setTemAssinatura(false);
  }
  function tirarFoto(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setFoto(String(rd.result));
    rd.readAsDataURL(f);
  }

  async function aceitar() {
    if (!termo) return;
    if (!nome || !cnpj || !endereco) { setErro("Preencha nome, CNPJ/CPF e endereço no item 1"); scrollTo(0, 0); return; }
    if (!foto) { setErro("Anexe uma foto sua"); return; }
    if (!temAssinatura) { setErro("Assine no espaço do PRESTADOR DE SERVIÇOS"); return; }
    setEnviando(true); setErro(null);
    try {
      const assinatura = canvasRef.current?.toDataURL("image/png") || "";
      const res = await fetch(`${API_URL}/api/instala/termos/${termo.id}/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assinatura_b64: assinatura, foto_b64: foto,
          dados_prestador: { nome, cnpj_cpf: cnpj, endereco },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Volta pra "/" — HomeGate reroteia. Se ainda há termo pendente, cai no próximo; senão vai pra HOJE.
      nav("/", { replace: true });
    } catch (e: any) { setErro(String(e?.message || e)); }
    finally { setEnviando(false); }
  }

  if (!termo) {
    return (
      <div style={pageBg(T)}>
        <p style={{ padding: 24, fontFamily: FONT_BODY, color: T.textSecondary }}>Carregando…</p>
      </div>
    );
  }
  if (termo.status === "aceito") {
    return (
      <div style={pageBg(T)}>
        <p style={{ padding: 24, fontFamily: FONT_BODY, color: T.textPrimary }}>
          Termo já aceito. {termo.pdf_url && (
            <a href={termo.pdf_url} target="_blank" rel="noreferrer" style={{ color: T.textPrimary, textDecoration: "underline" }}>Abrir PDF ↗</a>
          )}
        </p>
      </div>
    );
  }

  const secoes = agruparPorSecao(termo.itens_snapshot || []);
  const hoje = new Date();
  const dataStr = `São Paulo, ${String(hoje.getDate()).padStart(2, "0")} de ${MESES[hoje.getMonth() + 1]} de ${hoje.getFullYear()}.`;

  return (
    <div style={pageBg(T)}>
      <header style={hdr(T)}>
        <button onClick={() => nav(-1)} style={btnIcon(T)}><ArrowLeft size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.22em", color: T.textMuted }}>ASSINAR CONTRATO</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {obra?.cliente || "Obra"}
          </p>
        </div>
      </header>

      {/* PAPEL do documento — folha branca, fixed content-width, sombra */}
      <main style={{ padding: "18px 12px 40px", display: "flex", justifyContent: "center" }}>
        <article style={paper()}>
          {/* Capa */}
          <div style={{ background: "#000", color: "#fff", padding: 40, textAlign: "left" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, letterSpacing: "0.08em" }}>PARKET</div>
          </div>

          <div style={{ padding: "36px 32px" }}>
            <h1 style={h1()}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>

            <h2 style={h2()}>1. DAS PARTES</h2>
            <p style={p()}>
              <b>PKT SERVIÇOS DE REVESTIMENTOS LTDA</b>, pessoa jurídica de direito privado, com sede na
              Rua Coronel Ottoni Maciel, nº 373, Sala 53, Bairro Vila Izabel, Curitiba/PR, CEP 80320-000,
              inscrita no CNPJ nº 22.951.220/0001-33, doravante denominada <b>EMPRESA</b>;
            </p>
            <p style={p()}>
              <InlineInput valor={nome} onChange={setNome} placeholder="NOME COMPLETO DO PRESTADOR" width={340} /> ,
              inscrito no CNPJ/CPF nº <InlineInput valor={cnpj} onChange={setCnpj} placeholder="CNPJ ou CPF" width={200} /> ,
              residente em <InlineInput valor={endereco} onChange={setEndereco} placeholder="ENDEREÇO COMPLETO" width={380} /> ,
              doravante denominado <b>PRESTADOR DE SERVIÇOS</b>.
            </p>
            <p style={p()}>
              As partes resolvem firmar o presente Contrato de Prestação de Serviços,
              que será regido pelas cláusulas abaixo.
            </p>

            <h2 style={h2()}>2. OBJETO</h2>
            <p style={p()}>
              O presente contrato tem como objeto a instalação de produtos comercializados pela EMPRESA,
              conforme especificações, valores e prazos. O PRESTADOR declara conhecer as características
              técnicas dos produtos e se compromete a realizar as instalações conforme as orientações da EMPRESA.
            </p>

            <h2 style={h2()}>3. REMUNERAÇÃO</h2>
            <p style={p()}>Segue relação de itens/ambientes contratados{obra?.cliente ? <> da obra <b>{obra.cliente}</b></> : null}:</p>

            {secoes.length === 0 && <p style={{ ...p(), color: "#888" }}>Sem itens vinculados ao contrato.</p>}
            {secoes.map((sec) => (
              <table key={sec.codigo} style={tbl()}>
                <thead>
                  <tr>
                    <th colSpan={3} style={thHeader()}>ITEM {sec.codigo} {sec.titulo}</th>
                  </tr>
                  <tr>
                    <th style={th(90)}>ITEM</th>
                    <th style={th()}>AMBIENTE</th>
                    <th style={th(100, "right")}>{sec.unidade}</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.itens.map((it, idx) => (
                    <tr key={idx}>
                      <td style={td()}>{it.codigo || "-"}</td>
                      <td style={td()}>{it.ambiente || "-"}</td>
                      <td style={{ ...td(), textAlign: "right" }}>
                        {(it.quantidade ?? 0).toString().replace(".", ",")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

            <p style={p()}>Os pagamentos serão realizados da seguinte forma:</p>
            <ul style={ul()}>
              <li>Serviços concluídos até o dia 10: pagamento no dia 15 do mesmo mês.</li>
              <li>Serviços concluídos até o dia 25: pagamento no dia 30 do mesmo mês.</li>
            </ul>
            <p style={p()}>
              As medições terão uma retenção de 25% que será paga ao final da obra com o termo de entrega assinado pelo cliente.
            </p>
            <p style={p()}>O pagamento será efetuado mediante:</p>
            <ul style={ul()}>
              <li>envio de medições</li>
              <li>registro fotográfico da obra</li>
              <li>aprovação da EMPRESA e do CLIENTE.</li>
            </ul>
            <p style={p()}>
              O PRESTADOR não poderá cobrar diretamente qualquer valor do cliente final, sendo essa responsabilidade exclusiva da EMPRESA.
            </p>

            <h2 style={h2()}>4. ÁREA DE ATUAÇÃO</h2>
            <p style={p()}>
              O PRESTADOR poderá executar serviços em todo território nacional ou internacional, sem exclusividade.
              Qualquer alteração no projeto ou no escopo do serviço deverá ser previamente autorizada pela EMPRESA,
              mesmo que solicitada pelo cliente final.
            </p>

            <h2 style={h2()}>5. EXECUÇÃO DOS SERVIÇOS</h2>
            <p style={p()}>O PRESTADOR deverá:</p>
            <ul style={ul()}>
              <li>executar os serviços conforme especificações técnicas fornecidas pela EMPRESA;</li>
              <li>utilizar ferramentas adequadas e equipamentos de segurança necessários;</li>
              <li>manter comunicação constante sobre o andamento dos serviços;</li>
              <li>informar imediatamente qualquer irregularidade que possa comprometer a qualidade da instalação.</li>
            </ul>

            <h2 style={h2()}>6. DAS OBRIGAÇÕES DO PRESTADOR</h2>
            <p style={p()}>São obrigações do PRESTADOR:</p>
            <ul style={ul()}>
              <li>manter sua empresa regularizada perante órgãos fiscais e tributários;</li>
              <li>utilizar uniformes e EPIs obrigatórios durante a execução dos serviços;</li>
              <li>preservar a imagem e reputação da EMPRESA;</li>
              <li>manter sigilo sobre informações comerciais, estratégicas e valores praticados pela EMPRESA;</li>
              <li>comunicar eventuais reclamações ou problemas identificados durante a execução das obras.</li>
            </ul>

            <h2 style={h2()}>7. PRAZO</h2>
            <p style={p()}>
              O presente contrato terá vigência conforme os prazos estabelecidos pela empresa, iniciando-se
              na data de sua assinatura. Caso haja necessidade de prorrogação do prazo por motivos não
              atribuíveis à EMPRESA ou ao PRESTADOR, poderá ser firmado termo aditivo entre as partes.
              Situações de força maior, como:
            </p>
            <ul style={ul()}>
              <li>Impedimentos de acesso à obra;</li>
              <li>Decisões judiciais;</li>
              <li>Manifestações ou paralisações;</li>
              <li>Condições climáticas severas;</li>
            </ul>
            <p style={p()}>não gerarão penalidades para nenhuma das partes.</p>

            <h2 style={h2()}>8. DOS PRODUTOS E PROCEDIMENTOS</h2>
            <p style={p()}>O PRESTADOR deverá seguir rigorosamente:</p>
            <ul style={ul()}>
              <li>as instruções de instalação fornecidas pela EMPRESA;</li>
              <li>os prazos estabelecidos;</li>
              <li>as orientações técnicas e de segurança.</li>
            </ul>
            <p style={p()}>
              Não é permitido conceder descontos, prorrogações ou alterações comerciais sem autorização da EMPRESA.
            </p>

            <h2 style={h2()}>9. PENALIDADES</h2>
            <p style={p()}>
              O descumprimento dos prazos ou das condições estabelecidas poderá resultar na retenção de até 30%
              do valor do serviço, a título de penalidade contratual. Caso os prejuízos superem esse valor, a EMPRESA
              poderá buscar ressarcimento por vias legais.
            </p>

            <h2 style={h2()}>10. DA GARANTIA</h2>
            <p style={p()}>
              O PRESTADOR concede garantia de 12 (doze) meses sobre os serviços executados, contados a partir da
              entrega e aprovação final da instalação.
            </p>

            <h2 style={h2()}>11. RELAÇÃO</h2>
            <p style={p()}>
              O presente contrato estabelece relação de prestação de serviços autônoma, não gerando vínculo empregatício entre as partes.
            </p>

            <h2 style={h2()}>12. CESSÃO</h2>
            <p style={p()}>
              Este contrato não poderá ser transferido ou cedido a terceiros sem autorização prévia e por escrito da outra parte.
            </p>

            <h2 style={h2()}>13. ALTERAÇÕES</h2>
            <p style={p()}>
              Qualquer alteração deste contrato somente terá validade se formalizada por aditivo contratual assinado pelas partes.
            </p>

            <h2 style={h2()}>14. ASSINATURAS</h2>
            <p style={p()}>E por estarem de acordo, as partes assinam o presente contrato em duas vias de igual teor.</p>
            <p style={{ ...p(), textAlign: "center", marginTop: 18 }}>{dataStr}</p>

            <div style={{ marginTop: 30, textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #111", width: 260, margin: "0 auto", paddingTop: 6 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.18em" }}>
                  PKT SERVIÇOS DE REVESTIMENTOS LTDA
                </span>
              </div>
            </div>

            {/* Assinatura do PRESTADOR — canvas DENTRO do documento */}
            <div style={{ marginTop: 40, textAlign: "center" }}>
              <p style={{ fontSize: 9, letterSpacing: "0.20em", color: "#666", marginBottom: 6 }}>
                ASSINE NO ESPAÇO ABAIXO
              </p>
              <div style={{ background: "#fff", border: "1px solid #111", width: 320, height: 100, margin: "0 auto", touchAction: "none" }}>
                <canvas
                  ref={canvasRef}
                  width={640} height={200}
                  onPointerDown={comecarDesenho}
                  onPointerMove={moverDesenho}
                  onPointerUp={pararDesenho}
                  onPointerCancel={pararDesenho}
                  onPointerLeave={pararDesenho}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>
              <div style={{ marginTop: 6, display: "flex", justifyContent: "center", gap: 12 }}>
                <button onClick={limparAssinatura} style={btnMini()}>
                  <RotateCcw size={11} /> Limpar
                </button>
              </div>
              <div style={{ borderTop: "1px solid #111", width: 260, margin: "12px auto 0", paddingTop: 6 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.18em" }}>
                  PRESTADOR DE SERVIÇOS
                </span>
                {nome && (
                  <div style={{ fontSize: 10, color: "#111", marginTop: 4, fontWeight: 600 }}>{nome}</div>
                )}
              </div>
            </div>

            {/* Anexo EPIs */}
            <hr style={{ border: 0, borderTop: "1px solid #bbb", margin: "40px 0" }} />
            <h1 style={h1()}>USO DE UNIFORMES E EPIs</h1>
            <p style={p()}>
              O PRESTADOR declara estar ciente da obrigatoriedade do uso de uniforme e Equipamentos de Proteção
              Individual (EPIs) durante toda a execução dos serviços.
            </p>
            <p style={p()}>EPIs obrigatórios:</p>
            <ul style={ul()}>
              <li>Luvas</li><li>Calçados de segurança</li><li>Protetor auditivo</li>
              <li>Óculos de segurança</li><li>Respirador semifacial com filtro</li><li>Capacete</li>
            </ul>

            <h1 style={h1()}>FERRAMENTAS OBRIGATÓRIAS</h1>
            <p style={p()}>O PRESTADOR declara possuir as seguintes ferramentas para execução dos serviços:</p>
            <ul style={ul()}>
              <li>Martelo de borracha</li><li>Nível</li><li>Formão</li><li>Serra tico-tico</li>
              <li>Serra circular</li><li>Serra de bancada</li><li>Meia esquadria</li>
              <li>Parafusadeira</li><li>Furadeira</li><li>Compressor</li>
              <li>Pinador</li><li>Plaina</li><li>Esmerilhadeira</li><li>Martelete</li>
            </ul>

            {/* Registro fotográfico dentro do documento */}
            <hr style={{ border: 0, borderTop: "1px solid #bbb", margin: "40px 0" }} />
            <h1 style={h1()}>REGISTRO DO PRESTADOR</h1>
            <p style={p()}>
              Anexe uma foto sua para registro visual do prestador que assinou este termo.
            </p>
            {foto ? (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <img src={foto} alt="foto" style={{ maxWidth: "100%", maxHeight: 300, border: "1px solid #111" }} />
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setFoto(null)} style={btnMini()}>
                    <RotateCcw size={11} /> Tirar outra
                  </button>
                </div>
              </div>
            ) : (
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "22px 12px", border: "1px dashed #111", cursor: "pointer",
                color: "#111", fontSize: 12, letterSpacing: "0.14em", marginTop: 12,
                background: "#fafafa",
              }}>
                <Camera size={16} /> TIRAR FOTO
                <input type="file" accept="image/*" capture="user" onChange={tirarFoto} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </article>
      </main>

      {/* Barra de aceite fixa embaixo */}
      <div style={bottomBar(T)}>
        {erro && (
          <div style={{ padding: "8px 12px", background: "#fff", color: "#d05a3b", fontSize: 11, borderBottom: `1px solid ${T.border}` }}>
            {erro}
          </div>
        )}
        <button
          onClick={aceitar}
          disabled={enviando}
          style={{
            width: "100%", padding: "16px 18px", background: T.textPrimary, color: T.bg,
            border: "none", cursor: enviando ? "not-allowed" : "pointer",
            fontSize: 12, letterSpacing: "0.24em", fontWeight: 700,
            fontFamily: FONT_BODY, opacity: enviando ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <Check size={16} />
          {enviando ? "GERANDO CONTRATO…" : "ACEITAR E FINALIZAR ASSINATURA"}
        </button>
      </div>
    </div>
  );
}

/* ─── Componentes/estilos ────────────────────────────── */

function InlineInput({ valor, onChange, placeholder, width }: {
  valor: string; onChange: (v: string) => void; placeholder: string; width: number;
}) {
  return (
    <input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width, maxWidth: "100%", border: "none", borderBottom: "1px solid #111",
        padding: "2px 4px", background: valor ? "#f4f4f4" : "#fff5c8",
        fontFamily: FONT_BODY, fontSize: 11, color: "#111", outline: "none",
        borderRadius: 0,
      }}
    />
  );
}

const pageBg = (T: any): React.CSSProperties => ({
  minHeight: "100vh", background: T.bg, color: T.textPrimary, fontFamily: FONT_BODY,
  paddingBottom: 80,
});
const hdr = (T: any): React.CSSProperties => ({
  padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
  display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0,
  background: T.headerBg, zIndex: 10,
});
const btnIcon = (T: any): React.CSSProperties => ({
  background: "transparent", border: "none", color: T.textSecondary, cursor: "pointer", padding: 6,
});
const paper = (): React.CSSProperties => ({
  width: "100%", maxWidth: 720, background: "#fff", color: "#111",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)", overflow: "hidden",
});
const h1 = (): React.CSSProperties => ({
  fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "0.04em",
  marginBottom: 12, marginTop: 20,
});
const h2 = (): React.CSSProperties => ({
  fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
  marginTop: 18, marginBottom: 6, textTransform: "uppercase",
});
const p = (): React.CSSProperties => ({
  fontFamily: FONT_BODY, fontSize: 11, lineHeight: 1.55, color: "#111",
  marginBottom: 8, textAlign: "justify",
});
const ul = (): React.CSSProperties => ({
  fontSize: 11, lineHeight: 1.55, color: "#111", paddingLeft: 20, marginBottom: 8,
});
const tbl = (): React.CSSProperties => ({
  width: "100%", borderCollapse: "collapse", margin: "8px 0",
  fontSize: 10, fontFamily: FONT_BODY,
});
const thHeader = (): React.CSSProperties => ({
  background: "#111", color: "#fff", padding: "6px 10px", fontWeight: 700,
  letterSpacing: "0.06em", textAlign: "left",
});
const th = (width?: number, align?: "left" | "right"): React.CSSProperties => ({
  border: "1px solid #666", padding: "5px 8px", background: "#eaeaea",
  fontWeight: 700, textAlign: align || "left", width, whiteSpace: "nowrap",
});
const td = (): React.CSSProperties => ({
  border: "1px solid #999", padding: "5px 8px", verticalAlign: "top",
});
const btnMini = (): React.CSSProperties => ({
  background: "transparent", border: "none", color: "#666", cursor: "pointer",
  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
  display: "inline-flex", alignItems: "center", gap: 4,
});
const bottomBar = (T: any): React.CSSProperties => ({
  position: "fixed", left: 0, right: 0, bottom: 0,
  borderTop: `1px solid ${T.border}`, background: T.headerBg,
  boxShadow: "0 -4px 12px rgba(0,0,0,0.15)", zIndex: 20,
});
