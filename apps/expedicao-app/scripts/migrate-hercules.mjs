// Migra dados do Convex antigo (fantastic-caribou-164) pras tabelas expedicao_* (Supabase Cloud).
// Uso: SERVICE_KEY=... node scripts/migrate-hercules.mjs [--dry]
import crypto from "node:crypto";

const CONVEX = "https://fantastic-caribou-164.convex.cloud/api/query";
const SUPA = "https://hbxpilrxmitvzebluoom.supabase.co";
const KEY = process.env.SERVICE_KEY;
const DRY = process.argv.includes("--dry");
if (!KEY) { console.error("SERVICE_KEY ausente"); process.exit(1); }

async function q(path, args = {}) {
  const r = await fetch(CONVEX, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const j = await r.json();
  if (j.status !== "success") throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.value;
}

async function paginate(path, extraArgs = {}) {
  const all = [];
  let cursor = null;
  for (;;) {
    const res = await q(path, { ...extraArgs, paginationOpts: { numItems: 200, cursor } });
    all.push(...res.page);
    if (res.isDone) break;
    cursor = res.continueCursor;
  }
  return all;
}

const iso = (ms) => new Date(ms).toISOString();
const idMap = new Map();
const uid = (convexId) => {
  if (convexId == null) return null;
  if (!idMap.has(convexId)) idMap.set(convexId, crypto.randomUUID());
  return idMap.get(convexId);
};
const ref = (convexId) => (convexId != null && idMap.has(convexId) ? idMap.get(convexId) : null);

async function insert(table, rows) {
  if (!rows.length) return console.log(`  ${table}: 0 rows`);
  // uniformizar chaves (bulk insert com chaves mistas = NULL explícito quebra NOT NULL default)
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const norm = rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] === undefined ? null : r[k]])));
  if (DRY) return console.log(`  [dry] ${table}: ${rows.length} rows`);
  for (let i = 0; i < norm.length; i += 300) {
    const batch = norm.slice(i, i + 300);
    const r = await fetch(`${SUPA}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(batch),
    });
    if (!r.ok) throw new Error(`${table} batch ${i}: ${r.status} ${await r.text()}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

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
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": ct, "x-upsert": "true" },
    body: buf,
  });
  if (!up.ok) { console.warn(`  ! foto ${storageId}: upload ${up.status} ${await up.text()}`); return null; }
  return pub;
}

async function main() {
  console.log("== dump Convex ==");
  const [categories, products, clients] = await Promise.all([
    q("products:listCategories"),
    q("products:listProducts", { includeInactive: true }),
    q("clients:listClients", { includeInactive: true }),
  ]);
  const orders = await paginate("orders:listOrders");
  const movements = await paginate("stockMovements:listMovements");
  const transports = await paginate("toolTransports:listTransports");
  const weeks = await q("weeklyClients:listWeeks");
  const weekly = [];
  for (const w of weeks) {
    const label = typeof w === "string" ? w : w.weekLabel ?? w.label;
    weekly.push(...(await q("weeklyClients:listByWeek", { weekLabel: label })));
  }
  const vehicles = await q("fleet:listVehicles", {});
  const usage = await q("fleet:listUsage", {});
  const maintenance = await q("maintenance:listMaintenance", {});
  const inventories = await q("inventory:listInventories");
  console.log(`categorias=${categories.length} produtos=${products.length} clientes=${clients.length} pedidos=${orders.length} mov=${movements.length} transportes=${transports.length} semana=${weekly.length} veiculos=${vehicles.length} usos=${usage.length} manut=${maintenance.length} inventarios=${inventories.length}`);

  console.log("== categorias/produtos/clientes ==");
  await insert("expedicao_categorias", categories.map((c) => ({
    id: uid(c._id), name: c.name, description: c.description ?? null, created_at: iso(c._creationTime),
  })));

  const prodRows = [];
  for (const p of products) {
    let image_url = null;
    if (p.imageStorageId) {
      const u = await q("products:getImageUrl", { storageId: p.imageStorageId });
      image_url = await uploadPhoto(u, p.imageStorageId);
    }
    prodRows.push({
      id: uid(p._id), name: p.name, code: p.code, description: p.description ?? null,
      category_id: ref(p.categoryId), unit: p.unit, m2_per_box: p.m2PerBox ?? null,
      cost_price: p.costPrice ?? null, current_stock: p.currentStock, min_stock: p.minStock ?? null,
      image_url, active: p.active, created_at: iso(p._creationTime),
    });
  }
  await insert("expedicao_produtos", prodRows);

  await insert("expedicao_clientes", clients.map((c) => ({
    id: uid(c._id), name: c.name, document: c.document ?? null, phone: c.phone ?? null,
    email: c.email ?? null, address: c.address ?? null, address_number: c.addressNumber ?? null,
    complement: c.complement ?? null, neighborhood: c.neighborhood ?? null, city: c.city ?? null,
    state: c.state ?? null, zip_code: c.zipCode ?? null, freight_type: c.freightType,
    freight_value: c.freightValue ?? null, notes: c.notes ?? null, active: c.active,
    created_at: iso(c._creationTime),
  })));

  console.log("== pedidos + itens + assinaturas + fotos ==");
  const orderRows = [], itemRows = [], sigRows = [], photoRows = [];
  for (const o of orders) {
    if (!ref(o.clientId)) { console.warn(`  ! pedido ${o.orderNumber}: cliente ausente, pulado`); continue; }
    orderRows.push({
      id: uid(o._id), order_number: o.orderNumber, client_id: ref(o.clientId), status: o.status,
      freight_type: o.freightType, freight_value: o.freightValue ?? null, notes: o.notes ?? null,
      delivery_address: o.deliveryAddress ?? null, scheduled_date: o.scheduledDate ?? null,
      delivered_at: o.deliveredAt ?? null, created_at: iso(o._creationTime),
    });
    const det = await q("orders:getOrder", { id: o._id });
    for (const it of det?.items ?? []) {
      if (!ref(it.productId)) continue;
      itemRows.push({
        id: uid(it._id), order_id: ref(o._id), product_id: ref(it.productId),
        quantity: it.quantity, unit_price: it.unitPrice ?? null, notes: it.notes ?? null,
        created_at: iso(it._creationTime),
      });
    }
    const sig = await q("orderSignatures:getOrderSignature", { orderId: o._id });
    if (sig) sigRows.push({
      id: uid(sig._id), order_id: ref(o._id), signer_name: sig.signerName,
      signature_data: sig.signatureData, signed_at: sig.signedAt, created_at: iso(sig._creationTime),
    });
    const photos = await q("orderPhotos:getOrderPhotos", { orderId: o._id });
    for (const ph of photos ?? []) {
      const url = await uploadPhoto(ph.url, ph.storageId);
      if (url) photoRows.push({
        id: uid(ph._id), order_id: ref(o._id), url, type: ph.type,
        caption: ph.caption ?? null, created_at: iso(ph._creationTime),
      });
    }
  }
  await insert("expedicao_pedidos", orderRows);
  await insert("expedicao_pedido_itens", itemRows);
  await insert("expedicao_assinaturas", sigRows);
  await insert("expedicao_pedido_fotos", photoRows);

  console.log("== movimentações ==");
  await insert("expedicao_movimentacoes", movements.filter((m) => ref(m.productId)).map((m) => ({
    id: uid(m._id), product_id: ref(m.productId), type: m.type, quantity: m.quantity,
    quantity_before: m.quantityBefore, quantity_after: m.quantityAfter,
    order_id: ref(m.orderId), client_id: ref(m.clientId), reason: m.reason ?? null,
    notes: m.notes ?? null, created_by_name: m.userName ?? null, created_at: iso(m._creationTime),
  })));

  console.log("== transportes + fotos ==");
  const tRows = [], tpRows = [];
  for (const t of transports) {
    if (!ref(t.clientId)) { console.warn(`  ! transporte ${t.transportNumber}: cliente ausente, pulado`); continue; }
    tRows.push({
      id: uid(t._id), transport_number: t.transportNumber, client_id: ref(t.clientId),
      direction: t.direction, destination_client_id: ref(t.destinationClientId),
      freight_type: t.freightType, freight_value: t.freightValue ?? null, status: t.status,
      tools: t.tools ?? [], pickup_address: t.pickupAddress ?? null,
      delivery_address: t.deliveryAddress ?? null, scheduled_date: t.scheduledDate ?? null,
      delivered_at: t.deliveredAt ?? null, notes: t.notes ?? null, created_at: iso(t._creationTime),
    });
    const photos = await q("toolTransportPhotos:getPhotos", { transportId: t._id });
    for (const ph of photos ?? []) {
      const url = await uploadPhoto(ph.url, ph.storageId);
      if (url) tpRows.push({
        id: uid(ph._id), transport_id: ref(t._id), url, type: ph.type,
        caption: ph.caption ?? null, created_at: iso(ph._creationTime),
      });
    }
  }
  await insert("expedicao_transportes", tRows);
  await insert("expedicao_transporte_fotos", tpRows);

  console.log("== cliente da semana ==");
  await insert("expedicao_cliente_semana", weekly.map((w) => ({
    id: uid(w._id), week_label: w.weekLabel, client_code: w.clientCode, client_name: w.clientName,
    os: w.os, material: w.material ?? null, created_at: iso(w._creationTime),
  })));

  console.log("== frota ==");
  await insert("expedicao_veiculos", vehicles.map((v) => ({
    id: uid(v._id), plate: v.plate, model: v.model, brand: v.brand, year: v.year ?? null,
    type: v.type, color: v.color ?? null, status: v.status, notes: v.notes ?? null,
    current_km: v.currentKm ?? null, active: v.active, created_at: iso(v._creationTime),
  })));

  const usoRows = [];
  for (const u of usage) {
    if (!ref(u.vehicleId)) continue;
    let damage_photo_urls = null;
    if (u.damagePhotoIds?.length) {
      const urls = await q("fleet:getUsagePhotoUrls", { storageIds: u.damagePhotoIds });
      const up = [];
      for (let i = 0; i < urls.length; i++) {
        const r = await uploadPhoto(urls[i], u.damagePhotoIds[i]);
        if (r) up.push(r);
      }
      damage_photo_urls = up;
    }
    usoRows.push({
      id: uid(u._id), vehicle_id: ref(u.vehicleId), driver_name: u.driverName,
      destination: u.destination ?? null, purpose: u.purpose ?? null,
      departure_date: u.departureDate, departure_time: u.departureTime,
      arrival_date: u.arrivalDate ?? null, arrival_time: u.arrivalTime ?? null,
      km_departure: u.kmDeparture, km_arrival: u.kmArrival ?? null, km_driven: u.kmDriven ?? null,
      fuel_cost: u.fuelCost ?? null, damages: u.damages ?? null, damage_photo_urls,
      notes: u.notes ?? null, status: u.status, created_at: iso(u._creationTime),
    });
  }
  await insert("expedicao_veiculo_usos", usoRows);

  const manutRows = [];
  for (const m of maintenance) {
    if (!ref(m.vehicleId)) continue;
    let photo_urls = null;
    if (m.photoIds?.length) {
      const urls = await q("fleet:getUsagePhotoUrls", { storageIds: m.photoIds });
      const up = [];
      for (let i = 0; i < urls.length; i++) {
        const r = await uploadPhoto(urls[i], m.photoIds[i]);
        if (r) up.push(r);
      }
      photo_urls = up;
    }
    const budget_photo_url = m.budgetPhotoId ? await uploadPhoto(m.budgetPhotoUrl, m.budgetPhotoId) : null;
    manutRows.push({
      id: uid(m._id), vehicle_id: ref(m.vehicleId), type: m.type, description: m.description,
      workshop: m.workshop ?? null, cost: m.cost ?? null, date: m.date,
      resolved_at: m.resolvedAt ?? null, status: m.status, usage_id: ref(m.usageId),
      notes: m.notes ?? null, photo_urls, budget_photo_url,
      budget_value: m.budgetValue ?? null, created_at: iso(m._creationTime),
    });
  }
  await insert("expedicao_veiculo_manutencoes", manutRows);

  console.log("== inventários ==");
  const invRows = [], invItemRows = [];
  for (const inv of inventories) {
    invRows.push({
      id: uid(inv._id), name: inv.name, status: inv.status, notes: inv.notes ?? null,
      created_by_name: inv.createdByName ?? null, finished_at: inv.finishedAt ?? null,
      created_at: iso(inv._creationTime),
    });
    const det = await q("inventory:getInventory", { id: inv._id });
    for (const it of det?.items ?? []) {
      if (!ref(it.productId)) continue;
      invItemRows.push({
        id: uid(it._id), inventory_id: ref(inv._id), product_id: ref(it.productId),
        expected_quantity: it.expectedQuantity, counted_quantity: it.countedQuantity ?? null,
        difference: it.difference ?? null, notes: it.notes ?? null,
        counted_by_name: it.counterName ?? null, created_at: iso(it._creationTime),
      });
    }
  }
  await insert("expedicao_inventarios", invRows);
  await insert("expedicao_inventario_itens", invItemRows);

  console.log("== FIM ==");
}

main().catch((e) => { console.error(e); process.exit(1); });
