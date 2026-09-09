/**
 * Parser OFX (Open Financial Exchange) — bancos brasileiros.
 * Suporta:
 *   - SGML 1.x (Itaú, Bradesco, Santander, BB) — tags sem fechamento incluso
 *   - XML 2.x (Nubank, Inter, novas APIs) — tags fechadas
 *   - Encoding ISO-8859-1 (Windows-1252) ou UTF-8 — detecta pelo header
 *   - BANKACCTFROM (corrente/poupança) e CCACCTFROM (cartão de crédito)
 *
 * Use `parseOfxFile(file)` pra File do input (resolve encoding).
 * Use `parseOfx(text)` se já tiver o texto decodificado.
 */
export type OfxTransaction = {
  id: string;
  type: "credit" | "debit";
  date: string;            // YYYY-MM-DD
  amount: number;          // sempre positivo
  signedAmount: number;    // negativo pra debit
  memo: string;
  refNumber?: string;
};

export type OfxResult = {
  bankId: string;
  accountId: string;
  startDate: string;
  endDate: string;
  balance: number | null;
  transactions: OfxTransaction[];
};

/**
 * Lê o conteúdo de um File respeitando o CHARSET declarado no header OFX.
 * Bancos brasileiros normalmente declaram CHARSET:1252 (Windows-1252 = latin1).
 */
export async function parseOfxFile(file: File): Promise<OfxResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // Sniff ASCII inicial (primeiros 512 bytes — bastam pro header SGML/XML)
  const sniff = new TextDecoder("ascii").decode(buf.slice(0, 512));
  let encoding = "utf-8";
  const charsetMatch = sniff.match(/CHARSET[:=]?\s*"?([^\s"\r\n]+)/i);
  const encMatch = sniff.match(/ENCODING[:=]?\s*"?([^\s"\r\n]+)/i);
  const xmlEncMatch = sniff.match(/encoding\s*=\s*"([^"]+)"/i);

  const charsetVal = charsetMatch?.[1]?.toUpperCase();
  const encVal = encMatch?.[1]?.toUpperCase();
  const xmlEnc = xmlEncMatch?.[1]?.toLowerCase();

  if (xmlEnc) encoding = xmlEnc;
  else if (charsetVal === "1252" || charsetVal === "WINDOWS-1252") encoding = "windows-1252";
  else if (charsetVal === "ISO-8859-1" || charsetVal === "8859-1") encoding = "iso-8859-1";
  else if (encVal === "USASCII" || encVal === "ASCII") encoding = "windows-1252"; // BR usa 1252 mesmo se header diz USASCII
  else if (encVal === "UTF-8") encoding = "utf-8";

  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: false }).decode(buf);
  } catch {
    // Fallback: tenta latin1 (suporte universal em browsers)
    text = new TextDecoder("iso-8859-1", { fatal: false }).decode(buf);
  }
  return parseOfx(text);
}

/**
 * Extrai valor de uma tag simples `<TAG>valor` (formato SGML)
 * ou `<TAG>valor</TAG>` (XML). Aceita `<` no meio do valor desde que
 * não esteja seguido por outra tag conhecida.
 */
function tag(src: string, name: string): string | null {
  // 1) Forma XML: <TAG>...</TAG> (mais segura — qualquer conteúdo)
  const xml = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i");
  const xm = src.match(xml);
  if (xm) return xm[1].trim();
  // 2) Forma SGML: <TAG>valor até CR/LF ou próxima TAG OFX (uppercase ou /).
  //    `(?=<[A-Z/])` permite `<` no meio do memo quando seguido de minúscula/dígito
  //    (caso "<100 un" não é confundido com uma tag).
  const sgml = new RegExp(`<${name}>([\\s\\S]*?)(?=[\\r\\n]|<[A-Z/]|$)`, "i");
  const sm = src.match(sgml);
  return sm ? sm[1].trim() : null;
}

/**
 * Extrai blocos de transação <STMTTRN>...
 * Funciona com OU sem </STMTTRN> de fechamento (SGML antigo).
 * Estratégia: split pelo abertura, depois corta no próximo limite (próximo
 * <STMTTRN>, </BANKTRANLIST>, </STMTRS> ou </OFX>).
 */
function stmtTrnBlocks(src: string): string[] {
  const parts = src.split(/<STMTTRN>/i);
  if (parts.length <= 1) return [];
  // parts[0] é o que vem antes do primeiro <STMTTRN>, ignora
  const blocks: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    let block = parts[i];
    // Corta no fim natural — fechamento explícito ou próxima estrutura
    const cuts = [
      block.search(/<\/STMTTRN>/i),
      block.search(/<\/BANKTRANLIST>/i),
      block.search(/<\/STMTRS>/i),
      block.search(/<\/OFX>/i),
    ].filter((n) => n >= 0);
    if (cuts.length > 0) block = block.slice(0, Math.min(...cuts));
    blocks.push(block);
  }
  return blocks;
}

function parseOfxDate(s: string): string {
  // OFX dates: YYYYMMDD ou YYYYMMDDHHMMSS ou YYYYMMDDHHMMSS[-03:BRT]
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return s;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  // OFX padrão americano: `.` decimal, `,` milhar. Extratos BR mal formatados:
  // inverso. Heurística confiável: o ÚLTIMO separador é o decimal.
  const cleaned = raw.replace(/\s/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
    // vírgula é decimal (formato BR: "1.500,75")
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  if (lastDot > lastComma) {
    // ponto é decimal (formato OFX padrão: "1,500.75" ou "1500.75")
    return Number(cleaned.replace(/,/g, ""));
  }
  // sem separador
  return Number(cleaned);
}

export function parseOfx(text: string): OfxResult {
  // Remove tudo antes de <OFX>
  const ofxStart = text.search(/<OFX>/i);
  const body = ofxStart >= 0 ? text.slice(ofxStart) : text;

  // Conta: tenta BANKACCTFROM primeiro, depois CCACCTFROM (cartão)
  const acctBlockMatch = body.match(/<(BANKACCTFROM|CCACCTFROM)>([\s\S]*?)<\/\1>/i);
  const acctBlock = acctBlockMatch ? acctBlockMatch[2] : body;
  const bankId = tag(acctBlock, "BANKID") || "";
  const accountId = tag(acctBlock, "ACCTID") || tag(body, "ACCTID") || "";

  // Período: prefere DTSTART/DTEND dentro do BANKTRANLIST
  const tranListMatch = body.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i);
  const tranList = tranListMatch ? tranListMatch[1] : body;
  const startDate = parseOfxDate(tag(tranList, "DTSTART") || tag(body, "DTSTART") || "");
  const endDate = parseOfxDate(tag(tranList, "DTEND") || tag(body, "DTEND") || "");

  // Saldo: pega de LEDGERBAL ou AVAILBAL
  const balBlockMatch = body.match(/<(LEDGERBAL|AVAILBAL)>([\s\S]*?)<\/\1>/i);
  const balBlock = balBlockMatch ? balBlockMatch[2] : body;
  const balanceRaw = tag(balBlock, "BALAMT");
  const balance = balanceRaw != null ? parseAmount(balanceRaw) : null;

  const txBlocks = stmtTrnBlocks(tranList);
  const transactions: OfxTransaction[] = txBlocks
    .map((b) => {
      const dt = parseOfxDate(tag(b, "DTPOSTED") || "");
      const amtRaw = tag(b, "TRNAMT") || "0";
      const amt = parseAmount(amtRaw);
      // FITID estável: se não vier, deriva dos campos (NÃO usa random — senão
      // re-importações duplicam tudo).
      const fitid = tag(b, "FITID") || `${dt}|${amtRaw}|${tag(b, "MEMO") || tag(b, "NAME") || ""}`;
      return {
        id: fitid,
        type: amt >= 0 ? ("credit" as const) : ("debit" as const),
        date: dt,
        amount: Math.abs(amt),
        signedAmount: amt,
        memo: (tag(b, "MEMO") || tag(b, "NAME") || "").trim(),
        refNumber: tag(b, "REFNUM") || tag(b, "CHECKNUM") || undefined,
      };
    })
    .filter((tx) => tx.date); // descarta transações sem data (placeholders)

  return { bankId, accountId, startDate, endDate, balance, transactions };
}
