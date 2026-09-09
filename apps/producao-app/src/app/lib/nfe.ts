/** Parser de XML NF-e (modelo 55) client-side — substitui o processarXmlNFe do ERP legado (Apps Script). */

export type NfeItem = {
  codigo: string;        // det/prod/cProd (código do fornecedor)
  descricao: string;     // det/prod/xProd
  unidade: string;       // det/prod/uCom
  quantidade: number;    // det/prod/qCom
  valorUnitario: number; // det/prod/vUnCom
  valorTotal: number;    // det/prod/vProd
};

export type NfeParcela = {
  numero: string;        // cobr/dup/nDup
  vencimento: string;    // cobr/dup/dVenc (yyyy-mm-dd)
  valor: number;         // cobr/dup/vDup
};

export type NfeData = {
  chaveAcesso: string;
  numeroNf: string;
  dataEmissao: string;   // yyyy-mm-dd
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorTotal: number;
  itens: NfeItem[];
  parcelas: NfeParcela[];
};

function num(v: string | null | undefined): number {
  const n = parseFloat(v || "0");
  return Number.isFinite(n) ? n : 0;
}

function texto(el: Element | Document, tag: string): string {
  const node = el.getElementsByTagName(tag)[0];
  return node?.textContent?.trim() || "";
}

export function parseNfeXml(xmlText: string): NfeData {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("XML inválido — não foi possível interpretar o arquivo.");
  }
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("Arquivo não parece ser uma NF-e (tag infNFe ausente).");

  const chaveAcesso = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");

  const ide = infNFe.getElementsByTagName("ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0];
  if (!emit) throw new Error("NF-e sem emitente (tag emit).");

  const dEmiRaw = ide ? (texto(ide, "dhEmi") || texto(ide, "dEmi")) : "";
  const dataEmissao = dEmiRaw.slice(0, 10);

  const itens: NfeItem[] = [];
  const dets = infNFe.getElementsByTagName("det");
  for (let i = 0; i < dets.length; i++) {
    const prod = dets[i].getElementsByTagName("prod")[0];
    if (!prod) continue;
    itens.push({
      codigo: texto(prod, "cProd"),
      descricao: texto(prod, "xProd"),
      unidade: texto(prod, "uCom") || "UN",
      quantidade: num(texto(prod, "qCom")),
      valorUnitario: num(texto(prod, "vUnCom")),
      valorTotal: num(texto(prod, "vProd")),
    });
  }
  if (!itens.length) throw new Error("NF-e sem itens (tags det/prod).");

  const parcelas: NfeParcela[] = [];
  const dups = infNFe.getElementsByTagName("dup");
  for (let i = 0; i < dups.length; i++) {
    parcelas.push({
      numero: texto(dups[i], "nDup") || String(i + 1),
      vencimento: texto(dups[i], "dVenc"),
      valor: num(texto(dups[i], "vDup")),
    });
  }

  const icmsTot = infNFe.getElementsByTagName("ICMSTot")[0];
  const valorTotal = icmsTot ? num(texto(icmsTot, "vNF")) : itens.reduce((s, x) => s + x.valorTotal, 0);

  return {
    chaveAcesso,
    numeroNf: ide ? texto(ide, "nNF") : "",
    dataEmissao,
    fornecedorNome: texto(emit, "xNome"),
    fornecedorCnpj: texto(emit, "CNPJ") || texto(emit, "CPF"),
    valorTotal,
    itens,
    parcelas,
  };
}
