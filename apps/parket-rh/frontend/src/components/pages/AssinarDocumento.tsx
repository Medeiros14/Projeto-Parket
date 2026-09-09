/**
 * AssinarDocumento — página pública (sem login) onde o signatário lê o
 * documento e assina via canvas.
 *
 * Quando o doc vem com requer_kyc=true, o fluxo exige ANTES da assinatura:
 *   1. Selfie (câmera frontal)
 *   2. Foto de RG/CNH (câmera traseira)
 *   3. Assinatura no canvas
 * Selfie e foto sobem via anon direto pro bucket rh-documentos em
 * kyc/{token}/selfie.jpg e .../doc.jpg (RLS libera pelo token).
 * Os paths + PNG da assinatura + user-agent vão pra documento_public_sign.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Check, AlertTriangle, FileText, Camera, User, IdCard, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { fmtCPF } from "@/lib/format";

type Doc = {
  id: string;
  titulo: string;
  conteudo_html: string;
  status: string;
  assinado_em?: string | null;
  assinatura?: { png?: string; assinado_em?: string; nome_assinante?: string; selfie_path?: string; doc_path?: string } | null;
  requer_kyc?: boolean;
  colaborador: { nome: string; cpf: string | null };
  empresa: { razao_social: string; nome_fantasia: string | null; cnpj: string };
  mural_id?: string | null;
  mural_slug?: string | null;
  mural_titulo?: string | null;
};

export function AssinarDocumentoPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("documento_public_get", { p_token: token }).then(({ data, error: e }) => {
      if (e) setError(e.message || "Token inválido");
      else setDoc(data as Doc);
      setLoading(false);
    });
  }, [token]);

  const requerKyc = !!doc?.requer_kyc;
  const kycPronto = !requerKyc || (!!selfiePath && !!docPath);
  const podeSubmeter = !!assinatura && kycPronto;

  const submit = async () => {
    if (!assinatura) { alert("Você precisa assinar antes."); return; }
    if (requerKyc && (!selfiePath || !docPath)) {
      alert("Envie a selfie e a foto do documento antes de assinar.");
      return;
    }
    const ok = window.confirm(
      "Você confirma que esta é sua assinatura?\n\n" +
      "Ao clicar OK o documento será assinado de forma definitiva e o RH será notificado."
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const payload: any = {
        png: assinatura,
        assinado_em: new Date().toISOString(),
        nome_assinante: doc?.colaborador.nome || "",
        ip_user_agent: navigator.userAgent.slice(0, 200),
      };
      if (requerKyc) {
        payload.selfie_path = selfiePath;
        payload.doc_path = docPath;
      }
      const { error: e } = await supabase.rpc("documento_public_sign", {
        p_token: token,
        p_assinatura: payload,
      });
      if (e) throw new Error(e.message);
      // Gera PDF final em background (assinatura + página de manifesto).
      // Roda no backend parket-rh-api via proxy nginx; falha não bloqueia UX — RH tem endpoint pra re-gerar.
      fetch(`/api/documentos/${doc?.id}/pdf-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => {});
      setDone(true);
      if (doc?.mural_slug) {
        fetch("https://agente.parket.works/api/rh-whatsapp/mural-entrada", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mural_slug: doc.mural_slug,
            mural_titulo: doc.mural_titulo,
            nome: doc.colaborador.nome || "",
            cpf: doc.colaborador.cpf || "",
            evento: "assinado",
          }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Center><Loader2 size={28} className="animate-spin" style={{ color: "#0f172a" }} /><div style={{ fontSize: 13, color: "#64748b" }}>Carregando documento…</div></Center>;
  if (error || !doc) return <Center><AlertTriangle size={32} style={{ color: "#f59e0b" }} /><div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Documento não disponível</div><div style={{ fontSize: 12, color: "#64748b", maxWidth: 400, textAlign: "center" }}>{error}</div></Center>;
  if (done) return (
    <Center>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={28} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 8 }}>Documento assinado!</div>
      <div style={{ fontSize: 13, color: "#64748b", maxWidth: 400, textAlign: "center" }}>Recebemos a sua assinatura. Você pode fechar esta página.</div>
    </Center>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#0f172a", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="max-w-3xl mx-auto px-6 py-5">
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{doc.titulo}</div>
          {(doc.empresa.nome_fantasia || doc.empresa.razao_social) && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {doc.empresa.nome_fantasia || doc.empresa.razao_social}{doc.empresa.cnpj ? ` · CNPJ ${doc.empresa.cnpj}` : ""}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Para: <strong style={{ color: "#0f172a" }}>{doc.colaborador.nome}</strong>{doc.colaborador.cpf && ` · CPF ${fmtCPF(doc.colaborador.cpf)}`}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-4">
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "32px 28px", color: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="mural-content" dangerouslySetInnerHTML={{ __html: renderConteudoComPlaceholders(doc, assinatura) }} />
        </div>

        {doc.status === "assinado" ? (
          /* Modo readonly — documento já assinado, mostra assinatura registrada */
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={15} /> Documento já assinado
            </div>
            <div style={{ fontSize: 12, color: "#166534", marginBottom: 14 }}>
              Assinado em {doc.assinado_em ? new Date(doc.assinado_em).toLocaleString("pt-BR") : "—"}
              {doc.assinatura?.nome_assinante && <> por <strong>{doc.assinatura.nome_assinante}</strong></>}.
            </div>
            {doc.assinatura?.png && (
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Assinatura registrada</div>
                <img src={doc.assinatura.png} alt="Assinatura" style={{ maxWidth: "100%", maxHeight: 200 }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 12 }}>
              Validade legal: MP 2.200-2/2001
            </div>
          </div>
        ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {requerKyc && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <IdCard size={15} /> Identificação
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                Envie sua selfie e uma foto do seu documento oficial com foto (RG ou CNH).
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <PhotoCapture
                  token={token!}
                  kind="selfie"
                  label="Selfie"
                  icon={<User size={14} />}
                  facingMode="user"
                  onUploaded={setSelfiePath}
                />
                <PhotoCapture
                  token={token!}
                  kind="doc"
                  label="RG ou CNH"
                  icon={<IdCard size={14} />}
                  facingMode="environment"
                  onUploaded={setDocPath}
                />
              </div>
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={15} /> Assinatura digital
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
            Leia o documento acima e, se concordar, assine no campo abaixo. Sua assinatura tem validade legal nos termos da MP 2.200-2/2001.
          </div>
          <SignatureCanvas onChange={setAssinatura} />

          {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</div>}

          {requerKyc && !kycPronto && (
            <div style={{ fontSize: 11, color: "#b45309", background: "#fef3c7", border: "1px solid #fcd34d", padding: 8, borderRadius: 6, marginTop: 10 }}>
              Envie a selfie e a foto do documento pra habilitar a assinatura.
            </div>
          )}

          <button
            onClick={submit}
            disabled={!podeSubmeter || submitting}
            style={{
              width: "100%", padding: "14px 20px", marginTop: 16,
              background: (!podeSubmeter || submitting) ? "#cbd5e1" : "#0f172a",
              color: "white", border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 600,
              cursor: (!podeSubmeter || submitting) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: (!podeSubmeter || submitting) ? "none" : "0 4px 14px rgba(15,23,42,0.25)",
            }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirmar e enviar assinatura
          </button>
        </div>
        )}
      </main>
    </div>
  );
}

// ─── Substituição dos placeholders [[NOME/CPF/ASS_CONTRATADA]] ─────────
// No PDF final o backend faz isso; na tela precisa acontecer no browser.
function renderConteudoComPlaceholders(doc: Doc, assinaturaLive: string | null): string {
  const html = doc.conteudo_html || "";
  const nome = doc.colaborador?.nome || "";
  const cpf = doc.colaborador?.cpf || "";
  const cpfFmt = cpf ? fmtCPF(cpf) : "";
  // Se o doc já foi assinado, usa a assinatura persistida; senão, a que o usuário desenhou agora (preview live)
  const assFonte = doc.assinatura?.png || assinaturaLive || "";
  const assHtml = assFonte
    ? `<img src="${assFonte}" style="max-height:40px;vertical-align:middle" alt="Assinatura"/>`
    : "";
  return html
    .replace(/\[\[NOME_CONTRATADA\]\]/g, nome ? `<strong>${nome}</strong>` : "")
    .replace(/\[\[CPF_CONTRATADA\]\]/g, cpfFmt || "")
    .replace(/\[\[ASS_CONTRATADA\]\]/g, assHtml);
}


// ─── Captura de foto (selfie ou doc) ──────────────────────────────────
// Tenta getUserMedia primeiro; se falhar (permissão negada, sem HTTPS,
// desktop sem câmera etc.), cai pro <input type=file capture> que
// aciona a câmera nativa do celular ou file picker no desktop.
function PhotoCapture({
  token, kind, label, icon, facingMode, onUploaded,
}: {
  token: string;
  kind: "selfie" | "doc";
  label: string;
  icon: any;
  facingMode: "user" | "environment";
  onUploaded: (path: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopStream = () => {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
  };

  const abrirCamera = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStream(s);
      // Espera o próximo frame pra o elemento existir
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      }, 50);
    } catch (e: any) {
      // Fallback: abre o file picker (que em mobile aciona a câmera)
      fileRef.current?.click();
    }
  };

  const capturarDoVideo = async () => {
    if (!videoRef.current || !stream) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    stopStream();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) { setError("Falha ao capturar"); return; }
    await uploadBlob(blob);
  };

  const onFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    await uploadBlob(f);
  };

  const uploadBlob = async (blob: Blob) => {
    setUploading(true);
    setError(null);
    try {
      const path = `kyc/${token}/${kind === "selfie" ? "selfie" : "doc"}.jpg`;
      const { error: e } = await supabase.storage
        .from("rh-documentos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (e) throw e;
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(blob);
      });
      setPreview(dataUrl);
      onUploaded(path);
    } catch (e: any) {
      setError(e.message || "Upload falhou");
      onUploaded(null);
    } finally {
      setUploading(false);
    }
  };

  const refazer = () => {
    setPreview(null);
    onUploaded(null);
    setError(null);
  };

  useEffect(() => () => stopStream(), []); // cleanup

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        {icon} {label}
      </div>
      {preview ? (
        <div style={{ position: "relative" }}>
          <img src={preview} alt={label} style={{ width: "100%", borderRadius: 6, display: "block", maxHeight: 200, objectFit: "cover" }} />
          <button onClick={refazer} style={{
            position: "absolute", top: 4, right: 4, background: "rgba(15,23,42,0.85)", color: "white",
            border: "none", borderRadius: 4, padding: "3px 7px", fontSize: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <RotateCcw size={10} /> Refazer
          </button>
        </div>
      ) : stream ? (
        /* Modal fullscreen com a câmera — cobre a tela toda pra ele enquadrar direito */
        <div style={{
          position: "fixed", inset: 0, background: "#000", zIndex: 9999,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "absolute", top: 12, left: 12, color: "white", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>
            {icon} {label}
          </div>
          <video ref={videoRef} playsInline muted style={{
            width: "100%", height: "100%", objectFit: "contain", background: "#000",
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 16px 32px 16px",
            display: "flex", gap: 12, justifyContent: "center",
            background: "linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))",
          }}>
            <button onClick={() => { stopStream(); }} style={{
              padding: "12px 20px", background: "rgba(255,255,255,0.15)", color: "white",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>Cancelar</button>
            <button onClick={capturarDoVideo} style={{
              padding: "14px 28px", background: "white", color: "#0f172a",
              border: "none", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              <Camera size={16} /> Tirar foto
            </button>
          </div>
        </div>
      ) : (
        <button onClick={abrirCamera} disabled={uploading} style={{
          width: "100%", padding: "18px 12px", background: "white", color: "#0f172a",
          border: "1px dashed #94a3b8", borderRadius: 6, fontSize: 12, fontWeight: 500,
          cursor: uploading ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {uploading ? "Enviando…" : "Tirar foto"}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture={facingMode === "user" ? "user" : "environment"}
        onChange={onFile}
        style={{ display: "none" }}
      />
      {error && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 6 }}>{error}</div>}
    </div>
  );
}

// ─── Canvas de assinatura (existente) ──────────────────────────────────
// Mínimo pra considerar assinatura válida:
// comprimento total dos traços + nº de strokes diferentes.
// Evita que toque/scroll acidental no celular passe como assinatura.
const MIN_STROKE_LENGTH_PX = 400; // soma das distâncias entre pontos
const MIN_STROKES = 2; // pelo menos 2 levantadas de caneta

function SignatureCanvas({ onChange }: { onChange: (png: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const totalLen = useRef(0);
  const strokeCount = useRef(0);
  const [valid, setValid] = useState(false);

  const getPos = (ev: any): { x: number; y: number } => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t = ev.touches?.[0];
    const cx = t ? t.clientX : ev.clientX;
    const cy = t ? t.clientY : ev.clientY;
    return { x: ((cx - rect.left) / rect.width) * c.width, y: ((cy - rect.top) / rect.height) * c.height };
  };
  const start = (ev: any) => {
    ev.preventDefault();
    drawing.current = true;
    lastPt.current = getPos(ev);
    strokeCount.current += 1;
  };
  const move = (ev: any) => {
    if (!drawing.current) return;
    ev.preventDefault();
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = getPos(ev);
    const lp = lastPt.current!;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    const dx = p.x - lp.x, dy = p.y - lp.y;
    totalLen.current += Math.sqrt(dx * dx + dy * dy);
    lastPt.current = p;
    const nowValid = totalLen.current >= MIN_STROKE_LENGTH_PX && strokeCount.current >= MIN_STROKES;
    if (nowValid !== valid) setValid(nowValid);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPt.current = null;
    // Só envia o PNG pro parent se passou do limiar — assim o botão de
    // confirmar fica desabilitado até a assinatura ser real.
    if (totalLen.current >= MIN_STROKE_LENGTH_PX && strokeCount.current >= MIN_STROKES) {
      onChange(canvasRef.current!.toDataURL("image/png"));
    } else {
      onChange(null);
    }
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    totalLen.current = 0;
    strokeCount.current = 0;
    setValid(false);
    onChange(null);
  };
  const hasContent = valid;
  return (
    <div>
      <div style={{
        border: "2px dashed #cbd5e1",
        borderRadius: 8,
        background: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}>
        {!hasContent && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", color: "#94a3b8", fontSize: 13, fontStyle: "italic",
          }}>
            ✍ Desenhe sua assinatura aqui
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={260}
          style={{
            width: "100%",
            height: 260,
            touchAction: "none",
            cursor: "crosshair",
            display: "block",
          }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <button
          onClick={clear}
          style={{ fontSize: 12, color: "#64748b", background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}
        >
          Limpar e assinar de novo
        </button>
        <div style={{ fontSize: 11, fontWeight: 600, color: hasContent ? "#15803d" : "#94a3b8" }}>
          {hasContent ? "✓ Assinatura registrada" : "Aguardando assinatura"}
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: any }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 12, background: "#ffffff" }}>
      {children}
    </div>
  );
}
