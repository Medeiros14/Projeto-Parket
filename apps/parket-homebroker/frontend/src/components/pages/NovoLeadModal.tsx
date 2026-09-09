/**
 * NovoLeadModal — formulário rápido pra cadastrar um lead. SDR → funil
 * comercial-entrada/leads-entrada; vendedor → Pipeline comercial/
 * novas-oportunidades (atrelado a ele). Sincronizado em tempo real com o Space
 * (mesma tabela kanban_cards), aparece automaticamente no kanban do setor
 * Comercial assim que salvo.
 *
 * Visual: padrão SO Parket — cantos retos, Inter/Cinzel, tracking 0.18em nos
 * labels uppercase, paleta hb-cream/walnut/gold/accent.
 */
import { useEffect, useState } from "react";
import { X, Plus, Trash2, Upload, Link as LinkIcon, Loader2, CheckCircle2, AlertCircle, User, Phone, Mail, MapPin, Building2, Ruler, Calendar, Package, FileText, Paperclip } from "lucide-react";
import { api, type ContatoAdicional, type ContatoPapel, type AnexoLead, type CarteiraParceiro } from "../../lib/api";
import { ensureDriveFolder, uploadDriveFileScript, type DriveFolderInfo } from "../../lib/anexo-upload";
import { CondominioInput } from "../CondominioInput";
import type { AppUser } from "../../lib/auth";

const PAPEIS: { key: ContatoPapel; label: string }[] = [
  { key: "arquiteto",   label: "Arquiteto" },
  { key: "engenheiro",  label: "Engenheiro" },
  { key: "gerenciador", label: "Gerenciador" },
  { key: "comprador",   label: "Comprador" },
  { key: "outro",       label: "Outro" },
];

const PRODUTOS = ["Piso", "Deck", "Painel", "Forro", "Porta", "Marcenaria", "Revestimento", "Rodapé", "Escada", "Brise", "Sauna"];

export function NovoLeadModal({ onClose, onCreated, appUser, kind }: {
  onClose: () => void;
  onCreated?: (cardId: string) => void;
  appUser?: AppUser | null;
  /** Quadro de origem — se aberto no book "vendas", cai direto no Pipeline
   *  do vendedor; qualquer outro contexto entra no funil de Entrada (SDR). */
  kind?: "sdr" | "vendas";
}) {
  // Regra: o quadro em que o modal foi aberto manda. Fallback pro perfil
  // (funcaoComercial === "vendedor") só quando kind não foi informado, pra
  // não regredir chamadas antigas.
  const paraVendedor = kind
    ? kind === "vendas"
    : appUser?.funcaoComercial === "vendedor";
  // Contato principal
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");

  // Contatos adicionais
  const [contatos, setContatos] = useState<ContatoAdicional[]>([]);

  // Dados pra orçamento
  const [cidade, setCidade] = useState("");
  const [endereco, setEndereco] = useState("");
  const [condominio, setCondominio] = useState("");
  const [produtos, setProdutos] = useState<string[]>([]);
  const [metragem, setMetragem] = useState<number | "">("");
  const [previsao, setPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Anexos / links — arquivo vai DIRETO pro Drive do cliente (pasta
  // Home Broker/<nome>), sem limite de tamanho; bucket Supabase aposentado
  // (PKT-HB-DRIVE-20260902B). A pasta criada aqui vai no criarLead pro card
  // já nascer com drive_folder_id.
  const [arquivos, setArquivos] = useState<AnexoLead[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [upInfo, setUpInfo] = useState("");
  const [driveFolder, setDriveFolder] = useState<DriveFolderInfo | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criado, setCriado] = useState(false);
  const [mergedExistente, setMergedExistente] = useState(false);

  const addContato = (papel: ContatoPapel) => {
    setContatos((cs) => [...cs, { papel, nome: "", telefones: [""], emails: [] }]);
  };
  const updateContato = (idx: number, patch: Partial<ContatoAdicional>) => {
    setContatos((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const removeContato = (idx: number) => {
    setContatos((cs) => cs.filter((_, i) => i !== idx));
  };

  const toggleProduto = (p: string) => {
    setProdutos((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));
  };

  // Carteira do vendedor — usada como sugestão de autocomplete nos contatos
  // adicionais (arquiteto/engenheiro/gerenciador). Quando o user digita um nome
  // que já existe na carteira, pré-preenche telefones e email.
  const [carteira, setCarteira] = useState<CarteiraParceiro[]>([]);
  useEffect(() => {
    if (!appUser?.id) return;
    let alive = true;
    api.carteiraParceiros(appUser.id).then((arr) => { if (alive) setCarteira(arr); }).catch(() => {});
    return () => { alive = false; };
  }, [appUser?.id]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // A pasta no Drive é criada com o nome do cliente — precisa dele antes.
    if (!nome.trim()) {
      setError("Preencha o nome do contato antes de anexar: a pasta no Drive é criada com esse nome.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // Resolve (ou reusa) a pasta do cliente uma vez pro lote todo.
      let pasta = driveFolder;
      if (!pasta) {
        pasta = await ensureDriveFolder(nome.trim());
        setDriveFolder(pasta);
      }
      const novos: AnexoLead[] = [];
      for (const f of Array.from(files)) {
        // Qualquer tamanho: sessao resumable via gestao API + PUT direto no Google.
        const entry = await uploadDriveFileScript(f, pasta.folderId, (frac) =>
          setUpInfo(`${f.name} (${Math.round(frac * 100)}%)`)
        );
        novos.push({ url: entry.url, name: f.name, bytes: f.size, mimeType: entry.mimeType });
      }
      setArquivos((a) => [...a, ...novos]);
    } catch (e: any) {
      setError(e?.message || "Falha no upload do arquivo.");
    } finally {
      setUploading(false);
      setUpInfo("");
    }
  };

  const addLink = () => {
    const v = linkInput.trim();
    if (!v) return;
    setLinks((l) => [...l, v]);
    setLinkInput("");
  };

  const podeSalvar = nome.trim().length > 0 && celular.trim().length > 0 && !saving;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.criarLead({
        nome: nome.trim(),
        celular: celular.trim(),
        email: email.trim() || undefined,
        contatosAdicionais: contatos
          .filter((c) => c.nome.trim().length > 0)
          .map((c) => ({
            papel: c.papel,
            papel_label: c.papel_label,
            nome: c.nome.trim(),
            telefones: c.telefones.map((t) => t.trim()).filter(Boolean),
            emails: c.emails.map((e) => e.trim()).filter(Boolean),
          })),
        cidade: cidade.trim() || undefined,
        endereco: endereco.trim() || undefined,
        condominio: condominio.trim() || undefined,
        produto: produtos.length > 0 ? produtos.join(", ") : undefined,
        metragem: metragem === "" ? undefined : Number(metragem),
        previsaoInstalacao: previsao || undefined,
        observacoes: observacoes.trim() || undefined,
        attachments: arquivos,
        links,
        criadoPor: appUser?.nome || appUser?.email || undefined,
        paraVendedor,
        // Pasta do Drive criada no upload de anexos (se houve) — o card já
        // nasce com details.drive_folder_id/url apontando pra ela.
        driveFolderId: driveFolder?.folderId,
        driveFolderUrl: driveFolder?.folderUrl,
      });
      // Best-effort: salva contatos adicionais novos (arquiteto/eng/ger) na carteira do vendedor.
      // Só salva se: tem nome, papel mapeia pra carteira, NÃO existe na carteira ainda.
      if (appUser?.id) {
        const papelToTipo: Record<string, "arquiteto" | "engenheiro" | "gerenciadora"> = {
          arquiteto: "arquiteto", engenheiro: "engenheiro", gerenciador: "gerenciadora",
        };
        for (const c of contatos) {
          const tipo = papelToTipo[c.papel];
          if (!tipo || !c.nome.trim()) continue;
          const jaExiste = carteira.some((p) =>
            p.tipo === tipo && p.nome.toLowerCase() === c.nome.trim().toLowerCase()
          );
          if (jaExiste) continue;
          try {
            await api.criarParceiro({
              vendedor_id: appUser.id,
              tipo,
              nome: c.nome.trim(),
              empresa: null,
              email: (c.emails || []).filter(Boolean)[0] || null,
              telefone: (c.telefones || []).filter(Boolean)[0] || null,
              instagram: null,
              aniversario: null,
              cidade: null,
              estado: null,
              categorias: ["Contato"],
              observacoes: `Adicionado via "Adicionar Lead" — ${nome.trim()}`,
            });
          } catch (e) {
            console.warn("[NovoLead] auto-add parceiro falhou:", e);
          }
        }
      }
      setCriado(true);
      setMergedExistente(!!r.merged);
      onCreated?.(r.id);
      setTimeout(() => onClose(), r.merged ? 2400 : 1200);
    } catch (e: any) {
      setError(e?.message || "Falha ao criar o lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="bg-hb-panel border border-hb-border w-full max-w-2xl max-h-[92vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-hb-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="block w-[3px] h-[14px] bg-hb-accent shrink-0" />
            <h2 className="text-[11px] font-display uppercase text-hb-text" style={{ letterSpacing: "0.22em" }}>
              Adicionar Lead
            </h2>
            <span className="text-[9px] text-hb-textDim uppercase ml-2 shrink-0" style={{ letterSpacing: "0.14em" }}>
              {paraVendedor ? "· Pipeline Comercial" : "· Funil de Entrada"}
            </span>
            {/* Indicador de responsável — feedback claro de que o lead fica vinculado a quem cria */}
            {(appUser?.nome || appUser?.email) && (
              <span
                className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase bg-hb-accent/12 text-hb-accent border border-hb-accent/40 truncate"
                style={{ letterSpacing: "0.12em" }}
                title={paraVendedor
                  ? "O lead cai direto no seu Pipeline como vendedor responsável"
                  : "O lead será atribuído automaticamente a você como SDR responsável"}
              >
                <User size={9} /> {paraVendedor ? "Vendedor" : "SDR"}: {appUser?.nome || appUser?.email?.split("@")[0]}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-hb-textDim hover:text-hb-text shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Body — scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* SEÇÃO 1 — Contato principal */}
          <Section icon={<User size={10} />} label="Contato principal">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do contato *">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: João da Silva"
                  className="hb-input"
                  autoFocus
                />
              </Field>
              <Field label="WhatsApp / telefone *" icon={<Phone size={9} />}>
                <input
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="hb-input"
                  inputMode="tel"
                />
              </Field>
            </div>
            <Field label="E-mail" icon={<Mail size={9} />} className="mt-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@dominio.com (opcional)"
                type="email"
                className="hb-input"
                inputMode="email"
              />
            </Field>
          </Section>

          {/* SEÇÃO 2 — Contatos adicionais */}
          <Section icon={<User size={10} />} label="Contatos adicionais do projeto">
            <div className="flex flex-wrap gap-1.5">
              {PAPEIS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => addContato(p.key)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase border border-hb-border text-hb-textDim hover:text-hb-accent hover:border-hb-accent/60 transition"
                  style={{ letterSpacing: "0.14em" }}
                >
                  <Plus size={9} /> {p.label}
                </button>
              ))}
            </div>

            {contatos.length > 0 && (
              <div className="mt-3 space-y-2.5">
                {contatos.map((c, i) => (
                  <ContatoCard
                    key={i}
                    contato={c}
                    carteira={carteira}
                    onChange={(patch) => updateContato(i, patch)}
                    onRemove={() => removeContato(i)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* SEÇÃO 3 — Dados pra orçamento */}
          <Section icon={<Ruler size={10} />} label="Dados para orçamento">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" icon={<MapPin size={9} />}>
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex.: São Paulo"
                  className="hb-input"
                />
              </Field>
              <Field label="Condomínio / Edifício" icon={<Building2 size={9} />}>
                <CondominioInput
                  value={condominio}
                  onChange={setCondominio}
                  placeholder="Comece a digitar — sugere existentes"
                  className="hb-input"
                />
              </Field>
            </div>

            <Field label="Endereço" icon={<MapPin size={9} />} className="mt-3">
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, complemento, bairro"
                className="hb-input"
              />
            </Field>

            <Field label="Produto" icon={<Package size={9} />} className="mt-3">
              <div className="flex flex-wrap gap-1">
                {PRODUTOS.map((p) => {
                  const on = produtos.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProduto(p)}
                      className={`px-2 py-1 text-[9px] uppercase border transition ${
                        on
                          ? "bg-hb-accent/15 border-hb-accent/60 text-hb-accent"
                          : "border-hb-border text-hb-textDim hover:text-hb-text"
                      }`}
                      style={{ letterSpacing: "0.14em" }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Metragem (m²)" icon={<Ruler size={9} />}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="0.01"
                  value={metragem}
                  onChange={(e) => setMetragem(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex.: 120"
                  className="hb-input tabular text-right"
                />
              </Field>
              <Field label="Previsão de instalação" icon={<Calendar size={9} />}>
                <input
                  type="date"
                  value={previsao}
                  onChange={(e) => setPrevisao(e.target.value)}
                  className="hb-input tabular"
                />
              </Field>
            </div>

            <Field label="Observações" icon={<FileText size={9} />} className="mt-3">
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas, contexto da obra, urgência, restrições…"
                rows={3}
                className="hb-input resize-none"
              />
            </Field>
          </Section>

          {/* SEÇÃO 4 — Anexos */}
          <Section icon={<Paperclip size={10} />} label="Anexar arquivos ou link">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] uppercase border border-hb-border text-hb-textDim hover:text-hb-accent hover:border-hb-accent/60 cursor-pointer transition"
                style={{ letterSpacing: "0.14em" }}>
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                {uploading ? (upInfo ? `Enviando ${upInfo}` : "Enviando…") : "Anexar arquivo"}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => { void onUpload(e.target.files); e.currentTarget.value = ""; }}
                  disabled={uploading}
                />
              </label>
              <div className="flex items-center gap-1">
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                  placeholder="cole um link (Drive, Dropbox, foto…)"
                  className="hb-input w-72"
                />
                <button
                  type="button"
                  onClick={addLink}
                  className="px-2 py-1.5 border border-hb-border text-hb-textDim hover:text-hb-accent hover:border-hb-accent/60 transition"
                >
                  <LinkIcon size={11} />
                </button>
              </div>
            </div>

            {(arquivos.length > 0 || links.length > 0) && (
              <div className="mt-2.5 space-y-1">
                {arquivos.map((a, i) => (
                  <div key={`f${i}`} className="flex items-center justify-between px-2 py-1.5 border border-hb-border bg-hb-bg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={9} className="text-hb-textDim shrink-0" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-[10px] text-hb-text hover:text-hb-accent truncate" title={a.name}>
                        {a.name}
                      </a>
                      <span className="text-[9px] text-hb-textDim tabular shrink-0">{Math.round(a.bytes / 1024)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArquivos((arr) => arr.filter((_, j) => j !== i))}
                      className="text-hb-textDim hover:text-hb-red"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {links.map((l, i) => (
                  <div key={`l${i}`} className="flex items-center justify-between px-2 py-1.5 border border-hb-border bg-hb-bg">
                    <div className="flex items-center gap-2 min-w-0">
                      <LinkIcon size={9} className="text-hb-textDim shrink-0" />
                      <a href={l} target="_blank" rel="noreferrer" className="text-[10px] text-hb-text hover:text-hb-accent truncate" title={l}>
                        {l}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}
                      className="text-hb-textDim hover:text-hb-red"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Footer — ações */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-hb-border bg-hb-panelLight/40">
          <div className="text-[10px] min-h-[14px]">
            {error && (
              <span className="text-hb-red inline-flex items-center gap-1">
                <AlertCircle size={10} /> {error}
              </span>
            )}
            {criado && !mergedExistente && (
              <span className="text-hb-green inline-flex items-center gap-1">
                <CheckCircle2 size={10} /> Lead criado · sincronizado com o Space
              </span>
            )}
            {criado && mergedExistente && (
              <span className="text-hb-amber inline-flex items-center gap-1">
                <CheckCircle2 size={10} /> Já existia um lead ativo com esse celular — campos foram mesclados no card existente
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[10px] uppercase border border-hb-border text-hb-textDim hover:text-hb-text transition"
              style={{ letterSpacing: "0.14em" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!podeSalvar}
              className="px-4 py-1.5 text-[10px] uppercase bg-hb-accent text-hb-bg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
              style={{ letterSpacing: "0.14em", fontWeight: 600 }}
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              {saving ? "Salvando" : "Adicionar Lead"}
            </button>
          </div>
        </div>
      </div>

      {/* Estilo do input — uniforme (mesma altura, cantos retos, paleta hb) */}
      <style>{`
        .hb-input {
          width: 100%;
          background: rgb(var(--hb-bg) / 1);
          border: 1px solid rgb(var(--hb-border) / 1);
          padding: 6px 9px;
          font-size: 11px;
          color: rgb(var(--hb-text) / 1);
          outline: none;
          transition: border-color .15s;
        }
        .hb-input::placeholder { color: rgb(var(--hb-textDim) / 0.7); }
        .hb-input:focus { border-color: rgb(var(--hb-accent) / 1); }
      `}</style>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="block w-[3px] h-[10px] bg-hb-cream/40" />
        <span className="text-[9px] text-hb-textDim uppercase inline-flex items-center gap-1" style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
          {icon} {label}
        </span>
      </div>
      <div className="pl-2">{children}</div>
    </section>
  );
}

function Field({ label, icon, children, className }: { label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ""}`}>
      <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
        {icon} {label}
      </div>
      {children}
    </label>
  );
}

function ContatoCard({ contato, carteira, onChange, onRemove }: {
  contato: ContatoAdicional;
  carteira: CarteiraParceiro[];
  onChange: (patch: Partial<ContatoAdicional>) => void;
  onRemove: () => void;
}) {
  const papelLabel = PAPEIS.find((p) => p.key === contato.papel)?.label || "Contato";

  // Mapeia o papel do form (arquiteto/engenheiro/gerenciador) → tipo da carteira
  const papelToTipo: Record<string, string> = {
    arquiteto: "arquiteto",
    engenheiro: "engenheiro",
    gerenciador: "gerenciadora",
  };
  const tipoCarteira = papelToTipo[contato.papel];
  // Sugestões: parceiros da carteira que matcham o tipo do contato
  const sugestoes = tipoCarteira
    ? carteira.filter((p) => p.tipo === tipoCarteira)
    : [];
  const datalistId = `carteira-${contato.papel}`;

  // Quando o user sai do input nome, busca match na carteira e pré-preenche
  const onNomeBlur = () => {
    if (!contato.nome.trim() || sugestoes.length === 0) return;
    const hit = sugestoes.find((p) => p.nome.toLowerCase() === contato.nome.trim().toLowerCase());
    if (!hit) return;
    const tels = (contato.telefones || []).filter(Boolean);
    const mails = (contato.emails || []).filter(Boolean);
    if (hit.telefone && !tels.includes(hit.telefone)) tels.push(hit.telefone);
    if (hit.email && !mails.includes(hit.email)) mails.push(hit.email);
    onChange({
      telefones: tels.length > 0 ? tels : [""],
      emails: mails.length > 0 ? mails : [],
    });
  };

  const addTel = () => onChange({ telefones: [...contato.telefones, ""] });
  const updTel = (i: number, v: string) => onChange({ telefones: contato.telefones.map((t, idx) => (idx === i ? v : t)) });
  const rmTel = (i: number) => onChange({ telefones: contato.telefones.filter((_, idx) => idx !== i) });

  const addMail = () => onChange({ emails: [...contato.emails, ""] });
  const updMail = (i: number, v: string) => onChange({ emails: contato.emails.map((t, idx) => (idx === i ? v : t)) });
  const rmMail = (i: number) => onChange({ emails: contato.emails.filter((_, idx) => idx !== i) });

  return (
    <div className="border border-hb-border bg-hb-bg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="block w-[3px] h-[10px] bg-hb-walnut" />
          <span className="text-[10px] uppercase text-hb-cream" style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
            {papelLabel}
          </span>
          {contato.papel === "outro" && (
            <input
              value={contato.papel_label || ""}
              onChange={(e) => onChange({ papel_label: e.target.value })}
              placeholder="qual?"
              className="hb-input ml-1 max-w-[150px] py-0.5 text-[10px]"
            />
          )}
        </div>
        <button onClick={onRemove} className="text-hb-textDim hover:text-hb-red" title="Remover contato">
          <Trash2 size={11} />
        </button>
      </div>

      <Field label={sugestoes.length > 0 ? `Nome (${sugestoes.length} da sua carteira)` : "Nome"}>
        <input
          value={contato.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          onBlur={onNomeBlur}
          list={sugestoes.length > 0 ? datalistId : undefined}
          placeholder={sugestoes.length > 0 ? "Comece a digitar — sugere da carteira" : "Nome completo"}
          className="hb-input"
          autoComplete="off"
        />
        {sugestoes.length > 0 && (
          <datalist id={datalistId}>
            {sugestoes.map((s) => (
              <option key={s.id} value={s.nome}>{s.empresa ? `${s.nome} — ${s.empresa}` : s.nome}</option>
            ))}
          </datalist>
        )}
      </Field>

      <div className="mt-2">
        <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
          <Phone size={9} /> Telefones
        </div>
        {contato.telefones.map((t, i) => (
          <div key={i} className="flex items-center gap-1 mb-1">
            <input
              value={t}
              onChange={(e) => updTel(i, e.target.value)}
              placeholder="(11) 99999-9999"
              className="hb-input"
              inputMode="tel"
            />
            {contato.telefones.length > 1 && (
              <button onClick={() => rmTel(i)} className="p-1 text-hb-textDim hover:text-hb-red">
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addTel}
          className="text-[9px] uppercase text-hb-textDim hover:text-hb-accent inline-flex items-center gap-1"
          style={{ letterSpacing: "0.14em" }}
        >
          <Plus size={9} /> Outro telefone
        </button>
      </div>

      <div className="mt-2">
        <div className="text-[9px] uppercase text-hb-textDim mb-1 inline-flex items-center gap-1" style={{ letterSpacing: "0.14em" }}>
          <Mail size={9} /> E-mails
        </div>
        {contato.emails.length === 0 && (
          <button
            type="button"
            onClick={addMail}
            className="text-[9px] uppercase text-hb-textDim hover:text-hb-accent inline-flex items-center gap-1"
            style={{ letterSpacing: "0.14em" }}
          >
            <Plus size={9} /> Adicionar e-mail
          </button>
        )}
        {contato.emails.map((m, i) => (
          <div key={i} className="flex items-center gap-1 mb-1">
            <input
              value={m}
              onChange={(e) => updMail(i, e.target.value)}
              placeholder="email@dominio.com"
              type="email"
              className="hb-input"
            />
            <button onClick={() => rmMail(i)} className="p-1 text-hb-textDim hover:text-hb-red">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        {contato.emails.length > 0 && (
          <button
            type="button"
            onClick={addMail}
            className="text-[9px] uppercase text-hb-textDim hover:text-hb-accent inline-flex items-center gap-1 mt-1"
            style={{ letterSpacing: "0.14em" }}
          >
            <Plus size={9} /> Outro e-mail
          </button>
        )}
      </div>
    </div>
  );
}
