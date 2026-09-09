import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PenLine, Trash2, CheckCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  orderId: Id<"orders">;
  orderStatus: string;
};

export default function OrderSignature({ orderId, orderStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showPad, setShowPad] = useState(false);

  const signature = useQuery(api.orderSignatures.getOrderSignature, { orderId });
  const saveSig = useMutation(api.orderSignatures.saveOrderSignature);
  const deleteSig = useMutation(api.orderSignatures.deleteOrderSignature);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
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

  // Keep canvas size responsive
  useEffect(() => {
    if (!showPad) return;
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
  }, [showPad]);

  const handleSave = async () => {
    if (!signerName.trim()) {
      toast.error("Informe o nome de quem está assinando");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      toast.error("Por favor, faça a assinatura no campo acima");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    try {
      await saveSig({ orderId, signerName, signatureData: dataUrl });
      toast.success("Assinatura registrada com sucesso!");
      setShowPad(false);
      setSignerName("");
      setHasDrawn(false);
    } catch {
      toast.error("Erro ao salvar assinatura");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSig({ orderId });
      toast.success("Assinatura removida");
    } catch {
      toast.error("Erro ao remover assinatura");
    }
  };

  const canSign = orderStatus !== "cancelado";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Assinatura Digital de Entrega</span>
      </div>

      {/* Signature already saved */}
      {signature && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Assinatura registrada</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Assinado por</p>
              <p className="text-sm font-semibold">{signature.signerName}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(signature.signedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <img
              src={signature.signatureData}
              alt="Assinatura"
              className="w-full max-w-[280px] h-20 object-contain border rounded bg-white"
            />
            {canSign && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remover assinatura
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* No signature yet */}
      {!signature && canSign && (
        <>
          {!showPad ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowPad(true)}
            >
              <PenLine className="w-4 h-4 mr-2" />
              Coletar assinatura do recebedor
            </Button>
          ) : (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome de quem está recebendo *</Label>
                  <Input
                    placeholder="Ex: João da Silva"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Assinatura *</Label>
                  <div className="border rounded-lg bg-white dark:bg-zinc-900 overflow-hidden touch-none relative">
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
                      <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
                        Assine aqui com o dedo ou mouse
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={clearCanvas}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setShowPad(false); clearCanvas(); setSignerName(""); }}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleSave}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Salvar Assinatura
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!signature && !canSign && (
        <p className="text-xs text-muted-foreground">Assinatura não disponível para pedidos cancelados.</p>
      )}
    </div>
  );
}
