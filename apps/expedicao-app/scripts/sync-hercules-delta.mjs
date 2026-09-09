// Sync incremental Convex (fantastic-caribou-164) → expedicao_* (Supabase Cloud).
// Casa registros por created_at (= _creationTime da migração) + chaves naturais;
// insere os que faltam e atualiza campos mutáveis. Nunca deleta.
// Uso: SERVICE_KEY=... node scripts/sync-hercules-delta.mjs [--dry]
import crypto from "node:crypto";

const CONVEX = "https://fantastic-caribou-164.convex.cloud/api/query";
const SUPA = "https://hbxpilrxmitvzebluoom.supabase.co";
const KEY = process.env.SERVICE_KEY;
const DRY = process.argv.includes("--dry");
if (!KEY) { console.error("SERVICE_KEY ausente"); process.exit(1); }

async function q(path, args = {}) {
  const r = await fetch(CONVEX, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, args, format: "json" }) });
  const j = await r.json();
  if (j.status !== "success") throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.value;
}
async function paginate(path, extraArgs = {}) {
  const all = []; let cursor = null;
  for (;;) { const res = await q(path, { ...extraArgs, paginationOpts: { numItems: 200, cursor } }); all.push(...res.page); if (res.isDone) break; cursor = res.continueCursor; }
  return all;
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function supaAll(table, select) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPA}/rest/v1/${table}?select=${select}&limit=1000&offset=${from}`, { headers: H });
    if (!r.ok) throw new Error(`${table} select: ${r.status} ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
    from += 1000;
  }
  return out;
}
async function supaInsert(table, rows) {
  if (!rows.length) return;
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const norm = rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] === undefined ? null : r[k]])));
  console.log(`  + ${table}: ${rows.length} insert`);
  if (DRY) return;
  const r = await fetch(`${SUPA}/rest/v1/${table}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(norm) });
  if (!r.ok) throw new Error(`${table} insert: ${r.status} ${await r.text()}`);
}
async function supaUpdate(table, id, patch) {
  console.log(`  ~ ${table} ${id}: ${Object.keys(patch).join(",")}`);
  if (DRY) return;
  const r = await fetch(`${SUPA}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`${table} update ${id}: ${r.status} ${await r.text()}`);
}

const iso = (ms) => new Date(ms).toISOString();
const tkey = (ts) => (ts == null ? null : String(Date.parse(ts)));
// _creationTime do Convex tem fração de ms; a migração gravou truncado via new Date()
const ck = (ms) => String(Math.trunc(ms));

const seenPaths = new Set();
async function uploadPhoto(url, storageId) {
  if (!url) return null;
  const path = `migrado/${storageId}`;
  const pub = `${SUPA}/storage/v1/object/public/expedicao/${path}`;
  if (seenPaths.has(storageId)) return pub;
  seenPaths.add(storageId);
  if (DRY) return pub;
  const src = await fetch(url);
  if (!src.ok) { console.warn(`  ! foto ${storageId}: download ${src.status}`); return null; }
  const buf = Buffer.from(await src.arrayBuffer());
  const ct = src.headers.get("content-type") || "application/octet-stream";
  const up = await fetch(`${SUPA}/storage/v1/object/expedicao/${path}`, {
    method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": ct, "x-upsert": "true" }, body: buf,
  });
  if (!up.ok) { console.warn(`  ! foto ${storageId}: upload ${up.status}`); return null; }
  return pub;
}

// convexId → supabase uuid
const idMap = new Map();
const ref = (cid) => (cid != null ? idMap.get(cid) ?? null : null);
const newId = (cid) => { const u = crypto.randomUUID(); idMap.set(cid, u); return u; };

// Regra: dado nativo do expedicao.parket.works NUNCA é apagado/regredido pelo sync.
// - null do Convex não anula valor preenchido no Supabase
// - status nunca anda pra trás (nativo pode estar mais adiantado que o Hercules)
function diffPatch(existing, want) {
  const patch = {};
  for (const [k, v] of Object.entries(want)) {
    const cur = existing[k];
    if (v == null && cur != null) continue;
    if (k.endsWith("_at") || k === "date") { if (tkey(cur) !== tkey(v)) patch[k] = v; continue; }
    const a = cur ?? null, b = v ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) patch[k] = v;
  }
  return patch;
}

const STATUS_RANK = {
  rascunho: 0, pendente: 1, confirmado: 2, em_separacao: 3, em_andamento: 3,
  em_rota: 4, separado: 4, concluido: 5, entregue: 5, cancelado: 6,
};
function guardStatus(patch, existing) {
  if (!patch.status) return patch;
  const cur = STATUS_RANK[existing.status], want = STATUS_RANK[patch.status];
  if (cur != null && want != null && want < cur) { delete patch.status; delete patch.delivered_at; }
  return patch;
}

function nextFreeNumber(taken, prefix) {
  let max = 0;
  for (const n of taken) {
    const m = typeof n === "string" && n.startsWith(prefix) && n.match(/\d+$/);
    if (m) max = Math.max(max, parseInt(m[0]));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

async function main() {
  console.log("== dump Convex ==");
  const [products, clients, weeks, vehicles, usage, maintenance] = await Promise.all([
    q("products:listProducts", { includeInactive: true }),
    q("clients:listClients", { includeInactive: true }),
    q("weeklyClients:listWeeks"),
    q("fleet:listVehicles", {}),
    q("fleet:listUsage", {}),
    q("maintenance:listMaintenance", {}),
  ]);
  const orders = await paginate("orders:listOrders");
  const movements = await paginate("stockMovements:listMovements");
  const transports = await paginate("toolTransports:listTransports");
  const weekly = [];
  for (const w of weeks) {
    const label = typeof w === "string" ? w : w.weekLabel ?? w.label;
    weekly.push(...(await q("weeklyClients:listByWeek", { weekLabel: label })));
  }

  console.log("== produtos ==");
  const sProds = await supaAll("expedicao_produtos", "*");
  // códigos duplicam na origem — desambiguar por created_at
  const prodByCode = new Map();
  for (const p of sProds) (prodByCode.get(p.code) ?? prodByCode.set(p.code, []).get(p.code)).push(p);
  for (const p of products) {
    // current_stock fora do patch: estoque nativo é ajustado por delta das movimentações (abaixo)
    const want = {
      name: p.name, code: p.code, description: p.description ?? null, unit: p.unit,
      m2_per_box: p.m2PerBox ?? null, cost_price: p.costPrice ?? null,
      min_stock: p.minStock ?? null, active: p.active,
    };
    const cands = prodByCode.get(p.code) ?? [];
    const ex = cands.find((s) => tkey(s.created_at) === ck(p._creationTime));
    if (cands.length && !ex) { console.warn(`  ! produto ${p.code}: código em uso por registro nativo, pulado`); continue; }
    if (ex) {
      idMap.set(p._id, ex.id);
      const patch = diffPatch(ex, want);
      if (Object.keys(patch).length) await supaUpdate("expedicao_produtos", ex.id, patch);
    } else {
      let image_url = null;
      if (p.imageStorageId) image_url = await uploadPhoto(await q("products:getImageUrl", { storageId: p.imageStorageId }), p.imageStorageId);
      await supaInsert("expedicao_produtos", [{ id: newId(p._id), ...want, current_stock: p.currentStock, image_url, created_at: iso(p._creationTime) }]);
    }
  }

  console.log("== clientes ==");
  const sClients = await supaAll("expedicao_clientes", "*");
  const cliByKey = new Map(sClients.map((c) => [tkey(c.created_at) + "|" + c.name, c]));
  for (const c of clients) {
    const want = {
      name: c.name, document: c.document ?? null, phone: c.phone ?? null, email: c.email ?? null,
      address: c.address ?? null, address_number: c.addressNumber ?? null, complement: c.complement ?? null,
      neighborhood: c.neighborhood ?? null, city: c.city ?? null, state: c.state ?? null,
      zip_code: c.zipCode ?? null, freight_type: c.freightType, freight_value: c.freightValue ?? null,
      notes: c.notes ?? null, active: c.active,
    };
    const ex = cliByKey.get(ck(c._creationTime) + "|" + c.name) ?? sClients.find((s) => tkey(s.created_at) === ck(c._creationTime));
    if (ex) {
      idMap.set(c._id, ex.id);
      const patch = diffPatch(ex, want);
      if (Object.keys(patch).length) await supaUpdate("expedicao_clientes", ex.id, patch);
    } else {
      await supaInsert("expedicao_clientes", [{ id: newId(c._id), ...want, created_at: iso(c._creationTime) }]);
    }
  }

  console.log("== pedidos ==");
  const sOrders = await supaAll("expedicao_pedidos", "*");
  // match primário por created_at (número colide entre os dois sistemas — sequências independentes)
  const ordByCk = new Map();
  for (const o of sOrders) { const k = tkey(o.created_at); (ordByCk.get(k) ?? ordByCk.set(k, []).get(k)).push(o); }
  const ordNums = new Set(sOrders.map((o) => o.order_number));
  const newOrderIds = [];
  for (const o of orders) {
    if (!ref(o.clientId)) { console.warn(`  ! pedido ${o.orderNumber}: cliente ausente, pulado`); continue; }
    const want = {
      client_id: ref(o.clientId), status: o.status, freight_type: o.freightType,
      freight_value: o.freightValue ?? null, notes: o.notes ?? null,
      delivery_address: o.deliveryAddress ?? null, scheduled_date: o.scheduledDate ?? null,
      delivered_at: o.deliveredAt ?? null,
    };
    const cands = ordByCk.get(ck(o._creationTime)) ?? [];
    const ex = cands.length > 1 ? cands.find((s) => s.order_number === o.orderNumber) : cands[0];
    if (ex) {
      idMap.set(o._id, ex.id);
      const patch = guardStatus(diffPatch(ex, want), ex);
      if (Object.keys(patch).length) await supaUpdate("expedicao_pedidos", ex.id, patch);
    } else {
      let num = o.orderNumber;
      if (ordNums.has(num)) {
        num = nextFreeNumber(ordNums, "PED");
        console.warn(`  ! pedido ${o.orderNumber} (Hercules) colide com nativo → inserido como ${num}`);
      }
      ordNums.add(num);
      await supaInsert("expedicao_pedidos", [{ id: newId(o._id), order_number: num, ...want, created_at: iso(o._creationTime) }]);
      newOrderIds.push(o._id);
    }
  }

  console.log("== itens/assinaturas/fotos de pedidos ==");
  const sItems = await supaAll("expedicao_pedido_itens", "id,order_id,created_at");
  const sSigs = await supaAll("expedicao_assinaturas", "id,order_id,created_at");
  const sPhotos = await supaAll("expedicao_pedido_fotos", "id,order_id,created_at");
  const itemKeys = new Set(sItems.map((r) => r.order_id + "|" + tkey(r.created_at)));
  const sigKeys = new Set(sSigs.map((r) => r.order_id + "|" + tkey(r.created_at)));
  const photoKeys = new Set(sPhotos.map((r) => r.order_id + "|" + tkey(r.created_at)));
  for (const o of orders) {
    const oid = ref(o._id);
    if (!oid) continue;
    // pra pedidos antigos só busca filhos se o pedido mexeu depois da migração ou é novo
    const isNew = newOrderIds.includes(o._id);
    const det = await q("orders:getOrder", { id: o._id });
    for (const it of det?.items ?? []) {
      if (!ref(it.productId)) continue;
      if (itemKeys.has(oid + "|" + ck(it._creationTime))) continue;
      await supaInsert("expedicao_pedido_itens", [{
        id: crypto.randomUUID(), order_id: oid, product_id: ref(it.productId),
        quantity: it.quantity, unit_price: it.unitPrice ?? null, notes: it.notes ?? null,
        created_at: iso(it._creationTime),
      }]);
    }
    const sig = await q("orderSignatures:getOrderSignature", { orderId: o._id });
    if (sig && !sigKeys.has(oid + "|" + ck(sig._creationTime))) {
      await supaInsert("expedicao_assinaturas", [{
        id: crypto.randomUUID(), order_id: oid, signer_name: sig.signerName,
        signature_data: sig.signatureData, signed_at: sig.signedAt, created_at: iso(sig._creationTime),
      }]);
    }
    const photos = await q("orderPhotos:getOrderPhotos", { orderId: o._id });
    for (const ph of photos ?? []) {
      if (photoKeys.has(oid + "|" + ck(ph._creationTime))) continue;
      const url = await uploadPhoto(ph.url, ph.storageId);
      if (url) await supaInsert("expedicao_pedido_fotos", [{
        id: crypto.randomUUID(), order_id: oid, url, type: ph.type,
        caption: ph.caption ?? null, created_at: iso(ph._creationTime),
      }]);
    }
    if (isNew) console.log(`  pedido novo ${o.orderNumber} sincronizado com filhos`);
  }

  console.log("== movimentações ==");
  const sMovs = await supaAll("expedicao_movimentacoes", "id,created_at");
  const movKeys = new Set(sMovs.map((r) => tkey(r.created_at)));
  const movNew = movements.filter((m) => ref(m.productId) && !movKeys.has(ck(m._creationTime)));
  await supaInsert("expedicao_movimentacoes", movNew.map((m) => ({
    id: crypto.randomUUID(), product_id: ref(m.productId), type: m.type, quantity: m.quantity,
    quantity_before: m.quantityBefore, quantity_after: m.quantityAfter,
    order_id: ref(m.orderId), client_id: ref(m.clientId), reason: m.reason ?? null,
    notes: m.notes ?? null, created_by_name: m.userName ?? null, created_at: iso(m._creationTime),
  })));
  // estoque por DELTA (não valor absoluto do Convex): movimentos nativos e do Hercules compõem
  const deltaByProd = new Map();
  for (const m of movNew) {
    const pid = ref(m.productId);
    const d = Number(m.quantityAfter ?? 0) - Number(m.quantityBefore ?? 0);
    if (d) deltaByProd.set(pid, (deltaByProd.get(pid) ?? 0) + d);
  }
  for (const [pid, d] of deltaByProd) {
    const r = await fetch(`${SUPA}/rest/v1/expedicao_produtos?id=eq.${pid}&select=current_stock`, { headers: H });
    const [row] = await r.json();
    if (!row) continue;
    await supaUpdate("expedicao_produtos", pid, { current_stock: Number(row.current_stock) + d });
  }

  console.log("== transportes ==");
  const sTrans = await supaAll("expedicao_transportes", "*");
  const transByCk = new Map(sTrans.map((t) => [tkey(t.created_at), t]));
  const transNums = new Set(sTrans.map((t) => t.transport_number));
  for (const t of transports) {
    if (!ref(t.clientId)) continue;
    const want = {
      client_id: ref(t.clientId), direction: t.direction, destination_client_id: ref(t.destinationClientId),
      freight_type: t.freightType, freight_value: t.freightValue ?? null, status: t.status,
      tools: t.tools ?? [], pickup_address: t.pickupAddress ?? null, delivery_address: t.deliveryAddress ?? null,
      scheduled_date: t.scheduledDate ?? null, delivered_at: t.deliveredAt ?? null, notes: t.notes ?? null,
    };
    const ex = transByCk.get(ck(t._creationTime));
    if (ex) {
      idMap.set(t._id, ex.id);
      const patch = guardStatus(diffPatch(ex, want), ex);
      if (Object.keys(patch).length) await supaUpdate("expedicao_transportes", ex.id, patch);
    } else {
      let num = t.transportNumber;
      if (transNums.has(num)) {
        num = nextFreeNumber(transNums, "TRF");
        console.warn(`  ! transporte ${t.transportNumber} (Hercules) colide com nativo → inserido como ${num}`);
      }
      transNums.add(num);
      await supaInsert("expedicao_transportes", [{ id: newId(t._id), transport_number: num, ...want, created_at: iso(t._creationTime) }]);
      const photos = await q("toolTransportPhotos:getPhotos", { transportId: t._id });
      for (const ph of photos ?? []) {
        const url = await uploadPhoto(ph.url, ph.storageId);
        if (url) await supaInsert("expedicao_transporte_fotos", [{
          id: crypto.randomUUID(), transport_id: ref(t._id), url, type: ph.type,
          caption: ph.caption ?? null, created_at: iso(ph._creationTime),
        }]);
      }
    }
  }

  console.log("== cliente da semana ==");
  const sWeekly = await supaAll("expedicao_cliente_semana", "id,week_label,os,created_at");
  const wkKeys = new Set(sWeekly.map((w) => w.week_label + "|" + String(w.os)));
  const wkNew = weekly.filter((w) => !wkKeys.has(w.weekLabel + "|" + String(w.os)));
  await supaInsert("expedicao_cliente_semana", wkNew.map((w) => ({
    id: crypto.randomUUID(), week_label: w.weekLabel, client_code: w.clientCode,
    client_name: w.clientName, os: w.os, material: w.material ?? null, created_at: iso(w._creationTime),
  })));

  console.log("== frota ==");
  const sVeh = await supaAll("expedicao_veiculos", "*");
  const vehByPlate = new Map(sVeh.map((v) => [v.plate, v]));
  for (const v of vehicles) {
    const want = {
      plate: v.plate, model: v.model, brand: v.brand, year: v.year ?? null, type: v.type,
      color: v.color ?? null, status: v.status, notes: v.notes ?? null,
      current_km: v.currentKm ?? null, active: v.active,
    };
    const ex = vehByPlate.get(v.plate);
    if (ex) {
      idMap.set(v._id, ex.id);
      const patch = diffPatch(ex, want);
      if (patch.current_km != null && ex.current_km != null && Number(patch.current_km) < Number(ex.current_km)) delete patch.current_km;
      if (Object.keys(patch).length) await supaUpdate("expedicao_veiculos", ex.id, patch);
    } else {
      await supaInsert("expedicao_veiculos", [{ id: newId(v._id), ...want, created_at: iso(v._creationTime) }]);
    }
  }

  const sUsos = await supaAll("expedicao_veiculo_usos", "*");
  const usoByKey = new Map(sUsos.map((u) => [tkey(u.created_at), u]));
  for (const u of usage) {
    if (!ref(u.vehicleId)) continue;
    const want = {
      vehicle_id: ref(u.vehicleId), driver_name: u.driverName, destination: u.destination ?? null,
      purpose: u.purpose ?? null, departure_date: u.departureDate, departure_time: u.departureTime,
      arrival_date: u.arrivalDate ?? null, arrival_time: u.arrivalTime ?? null,
      km_departure: u.kmDeparture, km_arrival: u.kmArrival ?? null, km_driven: u.kmDriven ?? null,
      fuel_cost: u.fuelCost ?? null, damages: u.damages ?? null, notes: u.notes ?? null, status: u.status,
    };
    const ex = usoByKey.get(ck(u._creationTime));
    if (ex) {
      idMap.set(u._id, ex.id);
      const patch = diffPatch(ex, want);
      if (Object.keys(patch).length) await supaUpdate("expedicao_veiculo_usos", ex.id, patch);
    } else {
      let damage_photo_urls = null;
      if (u.damagePhotoIds?.length) {
        const urls = await q("fleet:getUsagePhotoUrls", { storageIds: u.damagePhotoIds });
        const up = [];
        for (let i = 0; i < urls.length; i++) { const r = await uploadPhoto(urls[i], u.damagePhotoIds[i]); if (r) up.push(r); }
        damage_photo_urls = up;
      }
      await supaInsert("expedicao_veiculo_usos", [{ id: newId(u._id), ...want, damage_photo_urls, created_at: iso(u._creationTime) }]);
    }
  }

  const sManut = await supaAll("expedicao_veiculo_manutencoes", "*");
  const manByKey = new Map(sManut.map((m) => [tkey(m.created_at), m]));
  for (const m of maintenance) {
    if (!ref(m.vehicleId)) continue;
    const want = {
      vehicle_id: ref(m.vehicleId), type: m.type, description: m.description,
      workshop: m.workshop ?? null, cost: m.cost ?? null, date: m.date,
      resolved_at: m.resolvedAt ?? null, status: m.status, usage_id: ref(m.usageId),
      notes: m.notes ?? null, budget_value: m.budgetValue ?? null,
    };
    const ex = manByKey.get(ck(m._creationTime));
    if (ex) {
      idMap.set(m._id, ex.id);
      const patch = diffPatch(ex, want);
      if (Object.keys(patch).length) await supaUpdate("expedicao_veiculo_manutencoes", ex.id, patch);
    } else {
      let photo_urls = null;
      if (m.photoIds?.length) {
        const urls = await q("fleet:getUsagePhotoUrls", { storageIds: m.photoIds });
        const up = [];
        for (let i = 0; i < urls.length; i++) { const r = await uploadPhoto(urls[i], m.photoIds[i]); if (r) up.push(r); }
        photo_urls = up;
      }
      const budget_photo_url = m.budgetPhotoId ? await uploadPhoto(m.budgetPhotoUrl, m.budgetPhotoId) : null;
      await supaInsert("expedicao_veiculo_manutencoes", [{ id: newId(m._id), ...want, photo_urls, budget_photo_url, created_at: iso(m._creationTime) }]);
    }
  }

  console.log("== FIM ==");
}

main().catch((e) => { console.error(e); process.exit(1); });
