import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const SUPA = "https://hbxpilrxmitvzebluoom.supabase.co";
const KEY = process.env.SERVICE_KEY;
if (!KEY) { console.error("SERVICE_KEY faltando"); process.exit(1); }
const DRY = process.argv.includes("--dry");

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const idMap = new Map();
const uid = (convexId) => {
  if (!convexId) return null;
  if (!idMap.has(convexId)) idMap.set(convexId, crypto.randomUUID());
  return idMap.get(convexId);
};
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

async function insert(table, rows) {
  if (!rows.length) return;
  const allKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const uniform = rows.map((r) => Object.fromEntries(allKeys.map((k) => [k, r[k] ?? null])));
  for (let i = 0; i < uniform.length; i += 300) {
    const batch = uniform.slice(i, i + 300);
    if (DRY) continue;
    const res = await fetch(`${SUPA}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(batch) });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  }
  console.log(`  ${table}: +${rows.length}`);
}

const seen = new Set();
async function uploadPhoto(url) {
  if (!url) return null;
  const sid = url.split("/").pop();
  const path = `migrado-fretes/${sid}`;
  const pub = `${SUPA}/storage/v1/object/public/expedicao/${path}`;
  if (seen.has(path)) return pub;
  seen.add(path);
  if (DRY) return pub;
  const r = await fetch(url);
  if (!r.ok) { console.warn(`  WARN foto ${sid}: ${r.status}`); return null; }
  const buf = Buffer.from(await r.arrayBuffer());
  const up = await fetch(`${SUPA}/storage/v1/object/expedicao/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": r.headers.get("content-type") || "application/octet-stream",
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!up.ok) { console.warn(`  WARN upload ${sid}: ${up.status} ${await up.text()}`); return null; }
  return pub;
}

// ===== agenda semanal =====
const weekly = JSON.parse(readFileSync("/tmp/hercules-dump/weekly.json", "utf8")).value;
console.log(`== agenda semana (${weekly.length}) ==`);
await insert("expedicao_agenda_semana", weekly.map((w) => ({
  id: uid(w._id),
  data: w.data,
  dia_semana: w.diaSemana ?? null,
  is_feriado: !!w.isFeriado,
  local: w.local ?? null,
  cliente: w.concluido ?? null,
  descricao: w.descricao ?? null,
  prioridade: w.prioridade ?? "Média",
  realizada: !!w.realizada,
  solicitado_por: w.solicitadoPor ?? null,
  created_at: iso(w._creationTime),
})));

// ===== agenda dia =====
const daily = readFileSync("/tmp/hercules-dump/daily.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
console.log(`== agenda dia (${daily.length}) ==`);
await insert("expedicao_agenda_dia", daily.map((d) => ({
  id: uid(d._id),
  data: d.data,
  cliente: d.concluido ?? null,
  descricao: d.descricao ?? null,
  prioridade: d.prioridade ?? "Média",
  realizada: !!d.realizada,
  solicitado_por: d.solicitadoPor ?? null,
  semana_id: d.weeklyScheduleId && idMap.has(d.weeklyScheduleId) ? idMap.get(d.weeklyScheduleId) : null,
  created_at: iso(d._creationTime),
})));

// ===== pendências =====
const pendRaw = readFileSync("/tmp/hercules-dump/pending.json", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pend = pendRaw.flatMap((p) => p.value ?? []);
console.log(`== pendências (${pend.length}) ==`);
await insert("expedicao_agenda_pendentes", pend.map((p) => ({
  id: uid(p._id),
  origem: p.origem,
  cliente: p.concluido ?? null,
  descricao: p.descricao ?? null,
  observacao: p.observacao ?? null,
  status_cor: p.statusCor ?? "branco",
  created_at: iso(p._creationTime),
})));

// ===== motoristas =====
const motoristas = JSON.parse(readFileSync("/tmp/hercules-dump/motoristas.json", "utf8")).value;
console.log(`== motoristas (${motoristas.length}) ==`);
await insert("expedicao_motoristas", motoristas.map((m) => ({
  id: uid(m._id),
  nome: m.nome,
  cpf: m.cpf ?? null,
  telefone: m.telefone ?? null,
  chave_pix: m.chavePix ?? null,
  banco: m.banco ?? null,
  agencia: m.agencia ?? null,
  conta: m.conta ?? null,
  tipo_conta: m.tipoConta ?? null,
  veiculo_modelo: m.veiculoModelo ?? null,
  veiculo_placa: m.veiculoPlaca ?? null,
  observacoes: m.observacoes ?? null,
  ativo: m.ativo !== false,
  created_at: iso(m._creationTime),
})));

// ===== fretes (com re-upload de fotos) =====
const fretes = JSON.parse(readFileSync("/tmp/hercules-dump/fretes.json", "utf8")).value;
console.log(`== fretes (${fretes.length}) ==`);
const rows = [];
for (const f of fretes) {
  const foto = await uploadPhoto(f.fotoUrl);
  const canhotos = [];
  for (const c of f.canhotosUrls ?? []) {
    const u = await uploadPhoto(c);
    if (u) canhotos.push(u);
  }
  rows.push({
    id: uid(f._id),
    numero: f.numero,
    status: f.status ?? "ativo",
    cliente_nome: f.clienteNome ?? null,
    cliente_email: f.clienteEmail ?? null,
    cliente_info: f.clienteInfo ?? null,
    descricao: f.descricao ?? null,
    observacoes: f.observacoes ?? null,
    data_saida: f.dataSaida ?? null,
    data_entrega: f.dataEntrega ?? null,
    origem_cidade: f.origemCidade ?? null,
    origem_estado: f.origemEstado ?? null,
    destino_cidade: f.destinoCidade ?? null,
    destino_estado: f.destinoEstado ?? null,
    motorista_nome: f.motoristaNome ?? null,
    motorista_cpf: f.motoristaCPF ?? null,
    motorista_telefone: f.motoristaTelefone ?? null,
    motorista_chave_pix: f.motoristaChavePix ?? null,
    motorista_banco: f.motoristaBanco ?? null,
    motorista_agencia: f.motoristaAgencia ?? null,
    motorista_conta: f.motoristaConta ?? null,
    motorista_tipo_conta: f.motoristaTipoConta ?? null,
    veiculo_modelo: f.veiculoModelo ?? null,
    veiculo_placa: f.veiculoPlaca ?? null,
    valor_total: f.valorTotal ?? null,
    percentual_adiantamento1: f.percentualAdiantamento1 ?? null,
    valor_adiantamento1: f.valorAdiantamento1 ?? null,
    adiantamento1_pago: !!f.adiantamento1Pago,
    valor_adiantamento2: f.valorAdiantamento2 ?? null,
    adiantamento2_pago: !!f.adiantamento2Pago,
    valor_saldo: f.valorSaldo ?? null,
    saldo_pago: !!f.saldoPago,
    foto_url: foto,
    canhotos_urls: canhotos,
    criado_em: f.criadoEm ?? iso(f._creationTime),
    created_at: iso(f._creationTime),
  });
}
await insert("expedicao_fretes", rows);

console.log("DONE" + (DRY ? " (dry)" : ""));
