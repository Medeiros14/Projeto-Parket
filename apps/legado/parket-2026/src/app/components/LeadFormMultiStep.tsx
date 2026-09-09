import { useState, useMemo } from "react";
import { readAttribution, readMetaCookies, readGaCookies } from "../lib/tracking";

// Pixel ID Meta (já carregado no index.html via fbq)
const PIXEL_ID = "1264030965924694";

// Endpoint do backend
const API_URL =
  (typeof window !== "undefined" && (window as any).__PARKET_API_URL) ||
  "https://agente.parket.works";

const PRODUTOS = [
  { id: "piso", label: "Piso", desc: "Pisos em madeira maciça e engenheirada" },
  { id: "deck", label: "Deck", desc: "Decks externos em madeira nobre" },
  { id: "sauna", label: "Sauna", desc: "Revestimentos e estruturas para sauna" },
  { id: "forro", label: "Forro", desc: "Forros de madeira para tetos" },
  { id: "painel", label: "Painel", desc: "Painéis ripados, lâminas e laca" },
  { id: "revestimento", label: "Revestimento", desc: "Revestimentos para parede" },
  { id: "porta", label: "Porta", desc: "Portas em madeira sob medida" },
  { id: "escada", label: "Escada", desc: "Degraus e revestimentos de escada" },
  { id: "marcenaria", label: "Marcenaria", desc: "Marcenaria sob medida" },
];

const REGIOES = [
  "São Paulo (Capital)",
  "São Paulo (Interior)",
  "Rio de Janeiro",
  "Minas Gerais",
  "Curitiba",
  "Brasília",
  "Goiás",
  "Outros",
];

const PERFIS = [
  { key: "arquiteto", label: "Arquiteto / Designer", desc: "Vou especificar para um cliente" },
  { key: "cliente_final", label: "Cliente Final", desc: "É para o meu projeto" },
] as const;

const INTERESSES = [
  { key: "completa", label: "Material + Instalação", desc: "Quero a Parket cuidando da entrega completa" },
  { key: "material", label: "Só Material", desc: "Tenho equipe própria para instalar" },
] as const;

type State = {
  area_m2: number;
  region: string;
  cityFree: string;
  products: string[];
  profile: "" | (typeof PERFIS)[number]["key"];
  interest: "" | (typeof INTERESSES)[number]["key"];
  description: string;
  name: string;
  email: string;
  phone: string;
};

const initial: State = {
  area_m2: 30,
  region: "",
  cityFree: "",
  products: [],
  profile: "",
  interest: "",
  description: "",
  name: "",
  email: "",
  phone: "",
};

const TOTAL_STEPS = 6;

function uuid(): string {
  // crypto.randomUUID com fallback
  try {
    return (crypto as any).randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

interface LeadFormMultiStepProps {
  /** true = renderiza como popup centralizado. false (default) = seção inline */
  asModal?: boolean;
  /** quando asModal=true, controla visibilidade */
  open?: boolean;
  /** callback pra fechar o modal */
  onClose?: () => void;
}

export function LeadFormMultiStep({ asModal = false, open = true, onClose }: LeadFormMultiStepProps = {}) {
  const [step, setStep] = useState(1);
  const [s, setS] = useState<State>(initial);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string>("");

  const set = <K extends keyof State>(key: K, value: State[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const toggleProduct = (id: string) => {
    setS((prev) => ({
      ...prev,
      products: prev.products.includes(id)
        ? prev.products.filter((p) => p !== id)
        : [...prev.products, id],
    }));
  };

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return !!s.region && (s.region !== "Outros" || !!s.cityFree.trim()) && s.area_m2 > 0;
      case 2:
        return s.products.length > 0;
      case 3:
        return !!s.profile;
      case 4:
        return !!s.interest;
      case 5:
        return true; // opcional
      case 6:
        return !!s.name.trim() && /@/.test(s.email) && s.phone.replace(/\D/g, "").length >= 10;
      default:
        return false;
    }
  }, [step, s]);

  const handleNext = () => {
    if (!canAdvance) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!canAdvance || sending) return;
    setErr("");
    setSending(true);

    const event_id = uuid();
    const attrib = readAttribution();
    const { fbp, fbc: fbcCookie } = readMetaCookies();
    const { ga: gaCookie, gid: gidCookie } = readGaCookies();

    // fbclid: prefere o do storage (capturado na 1ª pageview da sessão),
    // cai pra URL atual se não tiver
    const fbclid = attrib.fbclid || new URL(window.location.href).searchParams.get("fbclid") || null;
    // Sintetiza _fbc se o Pixel JS ainda não escreveu mas temos fbclid
    let fbc = fbcCookie || null;
    if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;

    const payload = {
      name: s.name.trim(),
      email: s.email.trim().toLowerCase(),
      phone: s.phone.replace(/\D/g, ""),
      area_m2: s.area_m2,
      region: s.region,
      cityFree: s.cityFree.trim(),
      products: s.products,
      profile: s.profile,
      interest: s.interest,
      description: s.description.trim(),

      // Meta CAPI
      fbp: fbp || null,
      fbc,
      fbclid,
      event_id,

      // UTM (atribuição da campanha)
      utm_source: attrib.utm_source || null,
      utm_medium: attrib.utm_medium || null,
      utm_campaign: attrib.utm_campaign || null,
      utm_term: attrib.utm_term || null,
      utm_content: attrib.utm_content || null,

      // Outros click IDs (gbraid/wbraid = Google Ads iOS/privacy — sem eles
      // perdemos atribuição na maioria das campanhas atuais).
      gclid: attrib.gclid || null,
      gbraid: attrib.gbraid || null,
      wbraid: attrib.wbraid || null,
      ttclid: attrib.ttclid || null,

      // Google Analytics
      ga_client_id: gaCookie || null,
      ga_session_id: gidCookie || null,

      // Navegação
      page_url: window.location.href,
      landing_url: attrib.landing_url || null,
      referrer: attrib.referrer || document.referrer || null,
      user_agent: navigator.userAgent,
    };

    try {
      const r = await fetch(`${API_URL}/api/leads/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();

      // Pixel JS — mesmo event_id pra deduplicação com CAPI
      try {
        const fbq = (window as any).fbq;
        if (typeof fbq === "function") {
          fbq(
            "track",
            "Lead",
            {
              content_name: "Lead Site Multistep",
              content_category: s.products.join(", "),
              currency: "BRL",
            },
            { eventID: event_id }
          );
        }
      } catch {}

      const wa = data?.wa_url;
      if (wa) {
        window.open(wa, "_blank", "noopener,noreferrer");
      }
      setStep(7); // tela de obrigado
    } catch (e: any) {
      setErr("Erro ao enviar. Tente novamente em alguns segundos.");
    } finally {
      setSending(false);
    }
  };

  const minMaxArea = useMemo(() => {
    return { min: 5, max: 1000, step: 5 };
  }, []);

  const cidadeFinal =
    s.region === "Outros" && s.cityFree ? `${s.cityFree} (Outros)` : s.region;

  const Inner = (
    <div className="bg-[#F1EEE8] p-8 md:p-14 relative">
          {asModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 text-[#8C8478] hover:text-[#2A2A2A] transition-colors text-[26px] leading-none w-9 h-9 flex items-center justify-center"
            >
              ×
            </button>
          )}
          {/* Header com passo X/Y */}
          {step <= TOTAL_STEPS && (
            <div
              className="text-[#9C8B6E] text-[11px] uppercase tracking-[0.12em] mb-6"
              style={{ fontWeight: 500 }}
            >
              Passo {step}/{TOTAL_STEPS}
            </div>
          )}

          {/* PASSO 1 */}
          {step === 1 && (
            <div>
              <h2
                className="text-[#2A2A2A] text-[26px] md:text-[36px] leading-[1.2] tracking-[0.01em] mb-10"
                style={{ fontWeight: 300 }}
              >
                Encontre a madeira ideal para o seu projeto.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div>
                  <label
                    className="text-[#8C8478] text-[11px] uppercase tracking-[0.1em] block mb-3"
                    style={{ fontWeight: 500 }}
                  >
                    Quantos m² você precisa atender?
                  </label>
                  <input
                    type="range"
                    min={minMaxArea.min}
                    max={minMaxArea.max}
                    step={minMaxArea.step}
                    value={s.area_m2}
                    onChange={(e) => set("area_m2", parseInt(e.target.value))}
                    className="w-full h-1 cursor-pointer appearance-none bg-[#D9D3CB] rounded-sm parket-range"
                  />
                  <div
                    className="text-[#2A2A2A] text-[40px] mt-5"
                    style={{ fontWeight: 300 }}
                  >
                    {s.area_m2}{" "}
                    <span className="text-[16px] text-[#9C8B6E]">m²</span>
                  </div>
                </div>
                <div>
                  <label
                    className="text-[#8C8478] text-[11px] uppercase tracking-[0.1em] block mb-3"
                    style={{ fontWeight: 500 }}
                  >
                    Cidade de execução
                  </label>
                  <select
                    value={s.region}
                    onChange={(e) => set("region", e.target.value)}
                    className="w-full bg-white border border-[#D9D3CB] text-[#2A2A2A] px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#9C8B6E] transition-colors duration-300 mt-2"
                    style={{ fontWeight: 400 }}
                  >
                    <option value="">Selecione a região</option>
                    {REGIOES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {s.region === "Outros" && (
                    <div className="mt-4">
                      <label
                        className="text-[#8C8478] text-[11px] uppercase tracking-[0.1em] block mb-3"
                        style={{ fontWeight: 500 }}
                      >
                        Qual cidade? <span className="text-[#c00]">*</span>
                      </label>
                      <input
                        type="text"
                        value={s.cityFree}
                        onChange={(e) => set("cityFree", e.target.value)}
                        placeholder="Ex: Joinville, Niterói, Goiânia..."
                        className="w-full bg-white border border-[#D9D3CB] text-[#2A2A2A] px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#9C8B6E]"
                      />
                      <div className="text-[12px] text-[#9C8B6E] mt-2">
                        Importante para estimarmos deslocamento e logística.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2 - Produtos */}
          {step === 2 && (
            <div>
              <h2
                className="text-[#2A2A2A] text-[26px] md:text-[36px] leading-[1.2] tracking-[0.01em] mb-3"
                style={{ fontWeight: 300 }}
              >
                Quais produtos você quer cotar?
              </h2>
              <p
                className="text-[#8C8478] text-[14px] mb-8"
                style={{ fontWeight: 400 }}
              >
                Selecione tudo que se aplica ao seu projeto.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PRODUTOS.map((p) => {
                  const sel = s.products.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className={`text-left p-5 transition-all duration-300 border ${
                        sel
                          ? "bg-[#2A2A2A] text-[#FAF8F5] border-[#2A2A2A]"
                          : "bg-white text-[#2A2A2A] border-[#D9D3CB] hover:border-[#9C8B6E]"
                      }`}
                    >
                      <div
                        className="text-[16px] mb-1"
                        style={{ fontWeight: 500 }}
                      >
                        {p.label}
                      </div>
                      <div
                        className={`text-[12px] leading-[1.5] ${
                          sel ? "text-[#FAF8F5]/70" : "text-[#8C8478]"
                        }`}
                      >
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASSO 3 - Perfil */}
          {step === 3 && (
            <div>
              <h2
                className="text-[#2A2A2A] text-[26px] md:text-[36px] leading-[1.2] tracking-[0.01em] mb-8"
                style={{ fontWeight: 300 }}
              >
                Você é arquiteto ou cliente final?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERFIS.map((p) => {
                  const sel = s.profile === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => set("profile", p.key)}
                      className={`text-left p-6 transition-all duration-300 border ${
                        sel
                          ? "bg-[#2A2A2A] text-[#FAF8F5] border-[#2A2A2A]"
                          : "bg-white text-[#2A2A2A] border-[#D9D3CB] hover:border-[#9C8B6E]"
                      }`}
                    >
                      <div className="text-[18px] mb-1" style={{ fontWeight: 500 }}>
                        {p.label}
                      </div>
                      <div
                        className={`text-[13px] leading-[1.55] ${
                          sel ? "text-[#FAF8F5]/70" : "text-[#8C8478]"
                        }`}
                      >
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASSO 4 - Interesse */}
          {step === 4 && (
            <div>
              <h2
                className="text-[#2A2A2A] text-[26px] md:text-[36px] leading-[1.2] tracking-[0.01em] mb-8"
                style={{ fontWeight: 300 }}
              >
                Qual modelo de atendimento você procura?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INTERESSES.map((p) => {
                  const sel = s.interest === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => set("interest", p.key)}
                      className={`text-left p-6 transition-all duration-300 border ${
                        sel
                          ? "bg-[#2A2A2A] text-[#FAF8F5] border-[#2A2A2A]"
                          : "bg-white text-[#2A2A2A] border-[#D9D3CB] hover:border-[#9C8B6E]"
                      }`}
                    >
                      <div className="text-[18px] mb-1" style={{ fontWeight: 500 }}>
                        {p.label}
                      </div>
                      <div
                        className={`text-[13px] leading-[1.55] ${
                          sel ? "text-[#FAF8F5]/70" : "text-[#8C8478]"
                        }`}
                      >
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASSO 5 - Descrição */}
          {step === 5 && (
            <div>
              <h2
                className="text-[#2A2A2A] text-[26px] md:text-[36px] leading-[1.2] tracking-[0.01em] mb-3"
                style={{ fontWeight: 300 }}
              >
                Quer nos contar mais sobre o projeto?
              </h2>
              <p className="text-[#8C8478] text-[14px] mb-7">
                Opcional. Estilo, prazo, referências, dúvidas — tudo ajuda.
              </p>
              <textarea
                value={s.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ex: Reforma de apartamento, queremos entregar até dezembro. Tenho referências de estilo escandinavo."
                rows={7}
                maxLength={1500}
                className="w-full bg-white border border-[#D9D3CB] text-[#2A2A2A] px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#9C8B6E] transition-colors duration-300"
                style={{ resize: "vertical", minHeight: 160, lineHeight: 1.55 }}
              />
              <div className="text-[11px] text-[#9C8B6E] text-right mt-2">
                {s.description.length}/1500
              </div>
            </div>
          )}

          {/* PASSO 6 - Contato + Resumo */}
          {step === 6 && (
            <div>
              <h2
                className="text-[#2A2A2A] text-[26px] md:text-[36px] leading-[1.2] tracking-[0.01em] mb-8"
                style={{ fontWeight: 300 }}
              >
                Seus dados de contato.
              </h2>
              <div className="mb-6">
                <label
                  className="text-[#8C8478] text-[11px] uppercase tracking-[0.1em] block mb-3"
                  style={{ fontWeight: 500 }}
                >
                  Nome completo
                </label>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="w-full bg-white border border-[#D9D3CB] text-[#2A2A2A] px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#9C8B6E]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    className="text-[#8C8478] text-[11px] uppercase tracking-[0.1em] block mb-3"
                    style={{ fontWeight: 500 }}
                  >
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={s.email}
                    onChange={(e) => set("email", e.target.value)}
                    className="w-full bg-white border border-[#D9D3CB] text-[#2A2A2A] px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#9C8B6E]"
                  />
                </div>
                <div>
                  <label
                    className="text-[#8C8478] text-[11px] uppercase tracking-[0.1em] block mb-3"
                    style={{ fontWeight: 500 }}
                  >
                    Telefone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={s.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-white border border-[#D9D3CB] text-[#2A2A2A] px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#9C8B6E]"
                  />
                </div>
              </div>
              <div
                className="bg-[#E8E2D7] p-5 mt-8 text-[13px] text-[#5A5249] leading-[1.65]"
                style={{ fontWeight: 400 }}
              >
                <div
                  className="text-[11px] uppercase tracking-[0.08em] text-[#9C8B6E] mb-2"
                  style={{ fontWeight: 600 }}
                >
                  Resumo
                </div>
                <div>
                  {s.area_m2} m² · {cidadeFinal || "—"}
                </div>
                {s.products.length > 0 && (
                  <div>
                    Produtos:{" "}
                    {s.products
                      .map((id) => PRODUTOS.find((p) => p.id === id)?.label)
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                <div>
                  {PERFIS.find((p) => p.key === s.profile)?.label || "—"} ·{" "}
                  {INTERESSES.find((i) => i.key === s.interest)?.label || "—"}
                </div>
              </div>
              {err && (
                <div className="text-[#c00] text-[13px] mt-4">{err}</div>
              )}
            </div>
          )}

          {/* PASSO 7 - Sucesso */}
          {step === 7 && (
            <div className="text-center py-10">
              <h2
                className="text-[#2A2A2A] text-[28px] md:text-[40px] leading-[1.15] mb-4"
                style={{ fontWeight: 300 }}
              >
                Obrigado, {s.name.split(" ")[0]}.
              </h2>
              <p
                className="text-[#8C8478] text-[15px] leading-[1.6] max-w-[520px] mx-auto"
                style={{ fontWeight: 400 }}
              >
                Recebemos seus dados. Uma janela do WhatsApp foi aberta — basta
                enviar a mensagem para um especialista da Parket te atender.
              </p>
              <button
                type="button"
                onClick={() => {
                  setS(initial);
                  setStep(1);
                }}
                className="mt-8 text-[#2A2A2A] text-[12px] uppercase tracking-[0.1em] border border-[#2A2A2A] px-7 py-3 hover:bg-[#2A2A2A] hover:text-[#FAF8F5] transition-all duration-500"
                style={{ fontWeight: 500 }}
              >
                Novo projeto
              </button>
            </div>
          )}

          {/* Navegação */}
          {step <= TOTAL_STEPS && (
            <div
              className={`flex items-center mt-12 ${
                step > 1 ? "justify-between" : "justify-end"
              }`}
            >
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-[#8C8478] text-[12px] uppercase tracking-[0.1em] hover:text-[#2A2A2A] transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  ← Voltar
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance}
                  className="bg-[#2A2A2A] text-white text-[12px] uppercase tracking-[0.1em] px-9 py-4 transition-opacity duration-300 disabled:opacity-30"
                  style={{ fontWeight: 600 }}
                >
                  Próximo passo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canAdvance || sending}
                  className="bg-[#2A2A2A] text-white text-[12px] uppercase tracking-[0.1em] px-9 py-4 transition-opacity duration-300 disabled:opacity-30"
                  style={{ fontWeight: 600 }}
                >
                  {sending ? "Enviando..." : "Enviar proposta"}
                </button>
              )}
            </div>
          )}
    </div>
  );

  const RangeStyles = (
    <style>{`
        .parket-range {
          background: #D9D3CB;
          outline: none;
        }
        .parket-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #2A2A2A;
          cursor: pointer;
          border: 3px solid #FAF8F5;
          box-shadow: 0 2px 6px rgba(0,0,0,0.18);
        }
        .parket-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #2A2A2A;
          cursor: pointer;
          border: 3px solid #FAF8F5;
          box-shadow: 0 2px 6px rgba(0,0,0,0.18);
        }
      `}</style>
  );

  if (asModal) {
    if (!open) return null;
    return (
      <div
        className="fixed inset-0 z-[100] flex items-start md:items-center justify-center px-3 py-6 md:px-6 md:py-12 bg-[#0D0D0D]/80 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-[920px] my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {Inner}
        </div>
        {RangeStyles}
      </div>
    );
  }

  return (
    <section className="bg-[#FAF8F5] py-12 md:py-20">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20">
        {Inner}
      </div>
      {RangeStyles}
    </section>
  );
}

export default LeadFormMultiStep;
