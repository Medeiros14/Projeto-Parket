import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MapPin, Truck, Calendar, CheckCircle2, Package,
  FileText, PackageSearch, PackageCheck, Navigation, XCircle, Camera, PenLine, RotateCcw, ImagePlus, X,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

const statusConfig = {
  rascunho: { label: "Rascunho", icon: FileText, color: "bg-muted text-muted-foreground" },
  confirmado: { label: "Confirmado", icon: PackageSearch, color: "bg-blue-500/15 text-blue-400" },
  em_separacao: { label: "Em Separação", icon: PackageCheck, color: "bg-amber-500/15 text-amber-400" },
  em_rota: { label: "Em Rota", icon: Navigation, color: "bg-purple-500/15 text-purple-400" },
  entregue: { label: "Entregue", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "bg-red-500/15 text-red-400" },
};

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
  retirada: "Retirada",
};

const unitLabels: Record<string, string> = { m2: "m²", cx: "cx", ml: "ml", un: "un" };

const photoTypeLabels: Record<string, string> = {
  separacao: "Separação",
  entrega: "Entrega",
  outros: "Outros",
};

const statusFlow = ["confirmado", "em_separacao", "em_rota", "entregue"];

export default function PedidoPublicoPage() {
  const { id: rawId } = useParams<{ id: string }>();
  // Decode URL-encoded ID (e.g. '+' encoded as '%2B') and strip any stray non-base32 characters
  const id = rawId ? decodeURIComponent(rawId) : undefined;
  const order = useQuery(api.orders.getOrderPublic, id ? { id: id as Id<"orders"> } : "skip");
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Photo upload state (only for "entregue" status)
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.orderPhotos.generateUploadUrlPublic);
  const addPhoto = useMutation(api.orderPhotos.addOrderPhotoPublic);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeSelectedPhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadPhotos = async () => {
    if (photoFiles.length === 0) { toast.error("Selecione pelo menos uma foto"); return; }
    setUploadingPhotos(true);
    try {
      for (const file of photoFiles) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("Falha ao enviar foto");
        const { storageId } = await res.json() as { storageId: string };
        await addPhoto({ orderId: id as Id<"orders">, storageId, type: "entrega", caption: photoCaption || undefined });
      }
      toast.success(`${photoFiles.length} foto(s) enviada(s) com sucesso!`);
      setPhotoFiles([]);
      setPhotoCaption("");
    } catch {
      toast.error("Erro ao enviar fotos");
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveSig = useMutation(api.orderSignatures.saveOrderSignaturePublic);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = 160;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [order]);

  const handleSave = async () => {
    if (!signerName.trim()) { toast.error("Informe seu nome completo"); return; }
    if (!hasDrawn) { toast.error("Por favor, assine no campo acima"); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSaving(true);
    try {
      await saveSig({ orderId: id as Id<"orders">, signerName, signatureData: dataUrl });
      toast.success("Assinatura registrada com sucesso!");
    } catch {
      toast.error("Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  if (order === undefined) {
    return (
      <div className="min-h-screen bg-muted p-6 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground/80">Pedido não encontrado</p>
          <p className="text-sm text-muted-foreground">O link pode ter expirado ou o pedido não existe.</p>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[order.status as keyof typeof statusConfig];
  const StatusIcon = cfg.icon;
  const currentStepIndex = statusFlow.indexOf(order.status);

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <img
            src="/logo-parket.png"
            alt="Parket"
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">Acompanhamento de Pedido</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Order number + status */}
        <div className="bg-card rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pedido</p>
              <h1 className="text-2xl font-bold text-foreground">{order.orderNumber}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Criado em {format(new Date(order.creationTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <span className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${cfg.color}`}>
              <StatusIcon className="w-4 h-4" />
              {cfg.label}
            </span>
          </div>

          {/* Progress tracker */}
          {order.status !== "cancelado" && (
            <div className="pt-2">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200 mx-6" />
                {statusFlow.map((s, idx) => {
                  const sCfg = statusConfig[s as keyof typeof statusConfig];
                  const SIcon = sCfg.icon;
                  const done = idx < currentStepIndex;
                  const active = idx === currentStepIndex;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1 z-10 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                          done
                            ? "bg-emerald-500 border-emerald-500"
                            : active
                            ? "bg-gray-900 border-gray-900"
                            : "bg-card border-gray-200"
                        }`}
                      >
                        <SIcon className={`w-3.5 h-3.5 ${done || active ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {sCfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Client & delivery info */}
        <div className="bg-card rounded-2xl shadow-sm p-5 space-y-2.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Informações</p>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground text-base">{order.clientName}</p>
            {order.deliveryAddress && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{order.deliveryAddress}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span>{freightLabels[order.freightType]}</span>
              {order.freightValue && order.freightValue > 0 && (
                <span className="font-medium text-foreground ml-1">R$ {order.freightValue.toFixed(2)}</span>
              )}
            </div>
            {order.scheduledDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span>Previsão: {format(new Date(order.scheduledDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Entregue em {format(new Date(order.deliveredAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-card rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Produtos</p>
          </div>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.productCode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-foreground">
                    {item.quantity} {unitLabels[item.productUnit] ?? item.productUnit}
                  </p>
                  {item.productUnit === "cx" && item.m2PerBox && (
                    <p className="text-xs text-muted-foreground">= {(item.quantity * item.m2PerBox).toFixed(2)} m²</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-card rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Observações</p>
            </div>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}

        {/* Photos */}
        {order.photos.length > 0 && (
          <div className="bg-card rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Fotos ({order.photos.length})
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {order.photos.map((photo) => (
                <div
                  key={photo._id}
                  className="group relative cursor-pointer rounded-xl overflow-hidden bg-muted aspect-square"
                  onClick={() => setLightbox(photo.url ?? null)}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption ?? "Foto do pedido"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Camera className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <span className="text-white text-xs font-medium">
                      {photoTypeLabels[photo.type] ?? photo.type}
                    </span>
                    {photo.caption && (
                      <p className="text-white/80 text-xs truncate">{photo.caption}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo upload — only when delivered */}
        {order.status === "entregue" && (
          <div className="bg-card rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Adicionar Foto de Entrega</p>
            </div>

            <div className="space-y-3">
              {/* Selected previews */}
              {photoFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photoFiles.map((file, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeSelectedPhoto(idx)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex flex-col items-center gap-2 text-muted-foreground hover:border-gray-300 hover:text-muted-foreground transition-colors cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                <span className="text-sm">Toque para selecionar ou tirar foto</span>
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
                <Input
                  placeholder="Ex: Produto instalado no local"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  className="text-sm"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleUploadPhotos}
                disabled={uploadingPhotos || photoFiles.length === 0}
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                {uploadingPhotos ? "Enviando..." : `Enviar ${photoFiles.length > 0 ? `${photoFiles.length} ` : ""}Foto(s)`}
              </Button>
            </div>
          </div>
        )}

        {/* Signature */}
        {order.status !== "cancelado" && (
          <div className="bg-card rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Assinatura de Recebimento</p>
            </div>

            {order.signature ? (
              /* Already signed — show it */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">{order.signature.signerName}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Assinado em {format(new Date(order.signature.signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                <div className="border rounded-xl bg-muted p-2 w-full">
                  <img
                    src={order.signature.signatureData}
                    alt="Assinatura digital"
                    className="max-h-24 w-full object-contain"
                  />
                </div>
              </div>
            ) : (
              /* Not signed yet — show pad for client */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Confirme o recebimento assinando abaixo.</p>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Seu nome completo *</Label>
                  <Input
                    placeholder="Ex: João da Silva"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Assinatura *</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl bg-muted overflow-hidden relative touch-none">
                    <canvas
                      ref={canvasRef}
                      className="w-full block cursor-crosshair"
                      style={{ height: 160, touchAction: "none" }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                    {!hasDrawn && (
                      <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
                        Assine aqui com o dedo ou mouse
                      </p>
                    )}
                  </div>
                  {hasDrawn && (
                    <button
                      onClick={clearCanvas}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground mt-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Limpar e refazer
                    </button>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {saving ? "Salvando..." : "Confirmar Recebimento"}
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">Parket · Gestão de Pedidos</p>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
