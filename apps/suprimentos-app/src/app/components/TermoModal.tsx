/** Fluxo igual ao sistema original: gera o termo pra revisar/imprimir ANTES,
 *  e só grava a transferência no banco quando o usuário confirma. */
import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Printer, Check, X } from "lucide-react";
import { fmtBRL } from "../lib/suprimentos";

export type TermoGrupo = {
  numero: string;
  /** Devolução: termo(s) de empréstimo referenciados (pra rastreabilidade), separados por vírgula. */
  referenteA?: string | null;
  funcionarioNome: string;
  cpf: string | null;
  empresa: string | null;
  /** ISO da emissão. Só o histórico preenche; na emissão nova é a data de hoje. */
  data?: string | null;
  itens: { descricao: string; marca: string | null; serie: string | null; valor: number }[];
};

/** "Refere-se ao termo X" no singular, "aos termos X, Y" quando a devolução encerra vários empréstimos. */
export function labelReferencia(referenteA: string) {
  return referenteA.includes(",") ? `Refere-se aos termos ${referenteA}` : `Refere-se ao termo ${referenteA}`;
}

type Props = {
  tipo: "emprestimo" | "devolucao";
  grupos: TermoGrupo[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

const EMPRESA = "EXCLUSIVE INSTALAÇÕES DE MOBILIÁRIOS LTDA";
const EMPRESA_CURTA = "EXCLUSIVE INSTALAÇÕES DE MOBILIÁRIOS";
const CNPJ = "51.992.934/0001-98";

const CLAUSULAS_EMPRESTIMO = [
  "Zelar pela correta utilização, guarda e conservação de todas as ferramentas sob minha responsabilidade, utilizando-as estritamente para os fins profissionais da empresa.",
  "Comunicar imediatamente ao setor responsável qualquer indício de defeito, dano, avaria ou irregularidade identificada no equipamento.",
  "Reconhecer que perdas, extravios, danos decorrentes de mau uso, negligência, roubo ou furto decorrentes de falta de cuidado na guarda serão de minha responsabilidade.",
  "Em caso de ocorrência das hipóteses previstas na cláusula anterior, autorizo o ressarcimento à empresa mediante desconto em folha ou acerto rescisório, conforme o Art. 462, §1º da CLT.",
  "Devolver todas as ferramentas recebidas em perfeitas condições de funcionamento ao término das atividades ou imediatamente quando solicitado pela empresa.",
];

const CLAUSULAS_DEVOLUCAO = [
  "Todas as ferramentas estão sendo devolvidas em perfeitas condições de funcionamento, salvo observações registradas no ato da devolução.",
  "Fui orientado a informar previamente qualquer defeito, dano, perda, extravio, roubo ou furto ocorrido durante o período de uso.",
  "Reconheço que eventuais danos por mau uso, perdas ou irregularidades já identificadas ou ainda a identificar, caso decorrentes de minha responsabilidade, poderão resultar em cobrança de ressarcimento conforme avaliação da empresa.",
  "Autorizo que valores referentes a ressarcimentos pendentes, caso existam, possam ser descontados dos pagamentos mensais ou, se aplicável, do acerto/rescisão contratual.",
  "Confirmo que todos os itens devolvidos foram conferidos em conjunto com o responsável da empresa no ato da entrega.",
];

export function termoHTML(tipo: "emprestimo" | "devolucao", grupos: TermoGrupo[]) {
  const emp = tipo === "emprestimo";
  const titulo = emp ? "TERMO DE RESPONSABILIDADE E EMPRÉSTIMO DE FERRAMENTAS" : "TERMO DE DEVOLUÇÃO DE FERRAMENTAS E EQUIPAMENTOS";
  const lblControle = "Nº CONTROLE";
  const lblValor = emp ? "VALOR DE REPOSIÇÃO" : "VALOR DE AVALIAÇÃO";
  const lblTotal = emp ? "VALOR TOTAL SOB GUARDA" : "VALOR TOTAL EQUIPAMENTOS DEVOLVIDOS";
  const intro = emp
    ? `Eu, acima identificado, declaro que recebi da <b>${EMPRESA}</b>, a título de empréstimo para uso exclusivo no desempenho de minhas atividades profissionais, as ferramentas e equipamentos descritos na tabela abaixo.`
    : `Eu, acima identificado, declaro que estou devolvendo à <b>${EMPRESA}</b> todas as ferramentas e equipamentos listados abaixo, anteriormente entregues para execução das minhas atividades profissionais.`;
  const secTitulo = emp ? "COMPROMISSOS E OBRIGAÇÕES DO COLABORADOR" : "DECLARAÇÕES E CONDIÇÕES GERAIS";
  const clausulas = emp ? CLAUSULAS_EMPRESTIMO : CLAUSULAS_DEVOLUCAO;
  const declaracao = emp
    ? `<b>DECLARAÇÃO DE RECEBIMENTO:</b> Confirmo que recebi os itens acima relacionados em perfeito estado de funcionamento e conservação, estando ciente de todas as regras relativas à guarda e responsabilidade sob estes equipamentos.`
    : `<b>CIÊNCIA E CONCORDÂNCIA:</b> Declaro estar ciente de todas as condições acima e que este termo possui validade legal para fins de comprovação da devolução dos equipamentos.`;
  const paginas = grupos
    .map((g) => {
      // Reimpressão do histórico mantém a data de emissão original; termo novo sai com a data de hoje.
      const dataExtenso = `São Paulo, ${new Date(g.data || Date.now()).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.`;
      const total = g.itens.reduce((s, i) => s + (i.valor || 0), 0);
      const linhas = g.itens
        .map((i, ix) => {
          const desc = [i.descricao, i.marca, i.serie ? `(SÉRIE ${i.serie})` : null].filter(Boolean).join(" ");
          return `<tr><td class="mono num-col">${String(ix + 1).padStart(2, "0")}</td><td class="mono desc-col">${desc}</td><td class="mono val-col">${fmtBRL(i.valor)}</td></tr>`;
        })
        .join("");
      const itensClausulas = clausulas
        .map((c, ix) => `<div class="clausula"><span class="cnum">${ix + 1}</span><p>${c}</p></div>`)
        .join("");
      return `
      <div class="pagina">
        <div class="topo">
          <div class="marca">${EMPRESA}</div>
          <div class="cnpj">CNPJ: ${CNPJ}</div>
        </div>
        <div class="faixa">${titulo}</div>
        <div class="ident">
          <div class="campo grande"><div class="lbl">FUNCIONÁRIO / COLABORADOR</div><div class="val">${g.funcionarioNome.toUpperCase()}</div></div>
          <div class="campo"><div class="lbl">DOCUMENTO (CPF)</div><div class="val">${g.cpf || "—"}</div></div>
          <div class="campo"><div class="lbl">${lblControle}</div><div class="val">${g.numero || "—"}</div>${
            !emp && g.referenteA
              ? `<div class="ref">${labelReferencia(g.referenteA)}</div>`
              : ""
          }</div>
        </div>
        <div class="intro">${intro}</div>
        <table>
          <thead><tr><th class="num-col">ITEM</th><th>DESCRIÇÃO DA FERRAMENTA / EQUIPAMENTO</th><th class="val-col">${lblValor}</th></tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr><td colspan="2" class="tot-lbl">${lblTotal}</td><td class="mono val-col tot-val">${fmtBRL(total)}</td></tr></tfoot>
        </table>
        <div class="sec-titulo">${secTitulo}</div>
        ${itensClausulas}
        <div class="declaracao">${declaracao}</div>
        <div class="data">${dataExtenso}</div>
        <div class="assinaturas">
          <div class="ass"><div class="linha"></div><div class="ass-nome">${g.funcionarioNome.toUpperCase()}</div><div class="ass-cargo">Funcionário / Colaborador</div></div>
          <div class="ass"><div class="linha"></div><div class="ass-nome">${EMPRESA_CURTA}</div><div class="ass-cargo">Departamento de Recursos Humanos</div></div>
        </div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Georgia,'Times New Roman',serif;color:#2b2b2b;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .mono{font-family:'Courier New',Courier,monospace}
    .pagina{padding:44px 52px;page-break-after:always}
    .topo{border-bottom:2px solid #3a2e26;padding-bottom:10px;margin-bottom:18px}
    .marca{font-size:21px;font-weight:700;color:#3a2e26;letter-spacing:0.01em}
    .cnpj{font-family:'Courier New',Courier,monospace;font-size:10px;color:#8a8378;margin-top:3px}
    .faixa{background:#3a2e26;color:#f4efe8;font-size:13px;font-weight:700;letter-spacing:0.06em;padding:9px 14px;margin-bottom:16px}
    .ident{display:flex;border:1px solid #d8d0c4;margin-bottom:16px}
    .campo{padding:9px 14px;border-left:1px solid #d8d0c4;flex:1}
    .campo:first-child{border-left:none}
    .campo.grande{flex:2.2}
    .lbl{font-size:8.5px;letter-spacing:0.1em;color:#8a8378;font-weight:700;margin-bottom:3px;font-family:Arial,Helvetica,sans-serif}
    .val{font-family:'Courier New',Courier,monospace;font-size:12px;font-weight:700}
    .ref{font-family:Arial,Helvetica,sans-serif;font-size:8.5px;color:#7a5c33;font-weight:600;margin-top:2px;letter-spacing:0.03em}
    .intro{border-left:3px solid #3a2e26;background:#f7f4ef;padding:10px 14px;font-size:11.5px;line-height:1.6;text-align:justify;margin-bottom:18px;font-family:Arial,Helvetica,sans-serif}
    table{width:100%;border-collapse:collapse;margin-bottom:18px}
    th{font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:0.08em;text-align:left;color:#3a2e26;padding:7px 10px;border-bottom:2px solid #3a2e26;background:#f7f4ef}
    td{padding:8px 10px;font-size:11px;border-bottom:1px solid #e5dfd5}
    tbody tr:nth-child(even) td{background:#faf8f4}
    .num-col{width:44px}
    .val-col{text-align:right;width:150px}
    th.val-col{text-align:right}
    .tot-lbl{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:700;color:#7a5c33;text-align:right;background:#efe9df;border-bottom:none;padding:9px 10px}
    .tot-val{font-weight:700;color:#7a5c33;background:#efe9df;border-bottom:none}
    .sec-titulo{font-size:12.5px;font-weight:700;color:#3a2e26;border-left:4px solid #3a2e26;padding-left:9px;margin:0 0 10px}
    .clausula{display:flex;gap:9px;margin-bottom:7px;font-family:Arial,Helvetica,sans-serif}
    .clausula p{margin:0;font-size:10.5px;line-height:1.55;text-align:justify;flex:1}
    .cnum{background:#3a2e26;color:#f4efe8;font-size:9px;font-weight:700;width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .declaracao{border:1px solid #d8d0c4;background:#f7f4ef;padding:11px 14px;font-size:10.5px;line-height:1.6;text-align:justify;margin:16px 0 14px;font-family:Arial,Helvetica,sans-serif}
    .data{text-align:right;font-size:11px;color:#8a8378;margin-bottom:58px;font-family:Arial,Helvetica,sans-serif}
    .assinaturas{display:flex;gap:70px}
    .ass{flex:1;text-align:center}
    .linha{border-top:1px solid #555;margin-bottom:6px}
    .ass-nome{font-size:10.5px;font-weight:700;font-family:Arial,Helvetica,sans-serif}
    .ass-cargo{font-family:'Courier New',Courier,monospace;font-size:9.5px;color:#8a8378;margin-top:2px}
    @page{size:A4;margin:0}
  </style></head><body>${paginas}</body></html>`;
}

export function imprimirTermo(tipo: "emprestimo" | "devolucao", grupos: TermoGrupo[]) {
  const w = window.open("", "_blank", "width=840,height=900");
  if (!w) { alert("Popup bloqueado — libere popups pra imprimir o termo."); return; }
  w.document.write(termoHTML(tipo, grupos));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

export default function TermoModal({ tipo, grupos, onConfirm, onClose }: Props) {
  const { t } = useTheme();
  const [confirmando, setConfirmando] = useState(false);
  const [feito, setFeito] = useState(false);
  const totalItens = grupos.reduce((s, g) => s + g.itens.length, 0);

  async function confirmar() {
    setConfirmando(true);
    try {
      await onConfirm();
      setFeito(true);
    } catch (e: any) {
      alert("Falha ao confirmar: " + (e?.message || e));
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: t.modalOverlay, zIndex: 100, display: "grid", placeItems: "center" }}>
      <div style={{
        width: 520, maxHeight: "86vh", overflowY: "auto", background: t.modalBg,
        border: `1px solid ${t.borderStrong}`, padding: 24, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {tipo === "emprestimo" ? "Revise o termo de empréstimo" : "Revise o termo de devolução"}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: t.textSecondary }}>
          {feito
            ? "Transferência confirmada e salva."
            : `${totalItens} item(ns) em ${grupos.length} termo(s). Nada foi transferido ainda — revise e confirme.`}
        </div>

        <div style={{ border: `1px solid ${t.border}`, maxHeight: 260, overflowY: "auto" }}>
          {grupos.map((g) => (
            <div key={g.numero + g.funcionarioNome} style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary }}>
                {g.numero ? `Termo ${g.numero} — ` : ""}{g.funcionarioNome}
                {g.empresa ? <span style={{ color: t.textMuted, fontWeight: 400 }}> · {g.empresa}</span> : null}
              </div>
              {tipo === "devolucao" && g.referenteA && (
                <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
                  {labelReferencia(g.referenteA)}
                </div>
              )}
              {g.itens.map((i, ix) => (
                <div key={ix} style={{ fontSize: 11.5, color: t.textSecondary, marginTop: 3 }}>
                  {i.descricao} {i.serie ? `· Série ${i.serie}` : ""} · {fmtBRL(i.valor)}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => imprimirTermo(tipo, grupos)} style={{
            flex: 1, background: t.inputBg, color: t.textPrimary, border: `1px solid ${t.borderStrong}`,
            padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Printer size={13} /> Imprimir / PDF
          </button>
          {feito ? (
            <button onClick={onClose} style={{
              flex: 1, background: t.accent, color: t.bg, border: "none",
              padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
            }}>
              Fechar
            </button>
          ) : (
            <button disabled={confirmando} onClick={confirmar} style={{
              flex: 1, background: t.success, color: "#08240f", border: "none",
              padding: "10px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: confirmando ? 0.6 : 1,
            }}>
              <Check size={13} /> {confirmando ? "Transferindo…" : "Confirmar transferência"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
