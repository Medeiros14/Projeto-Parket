import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Truck, Car, LogOut, LogIn, CheckCircle2, AlertTriangle, Camera, X,
  Navigation, ChevronRight, ChevronLeft, Download, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";

// ── Inject motorista-specific manifest on mount ──────────────────────────────
function useMotoristaManifest() {
  useEffect(() => {
    // Override the manifest link for this page
    let link = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    const originalHref = link?.href;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = "/motorista.webmanifest";

    // Update theme-color
    let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    const originalColor = meta?.content;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = "#111111";

    return () => {
      // Restore original manifest when leaving the page
      if (link && originalHref) link.href = originalHref;
      if (meta && originalColor) meta.content = originalColor;
    };
  }, []);
}

// ── PWA install prompt ───────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return { prompt, installed, triggerInstall };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = { carro: "Carro", caminhao: "Caminhão", van: "Van", moto: "Moto" };

type Step = "select" | "departure" | "vehicle_in_use" | "arrival" | "done";

function VehicleIcon({ type, className }: { type: string; className?: string }) {
  if (type === "caminhao" || type === "van") return <Truck className={cn("w-5 h-5", className)} />;
  return <Car className={cn("w-5 h-5", className)} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MotoristaPage() {
  useMotoristaManifest();
  const { prompt, installed, triggerInstall } = useInstallPrompt();

  const vehicles = useQuery(api.fleetPublic.listVehiclesPublic, {});
  const generateUploadUrl = useMutation(api.fleetPublic.generateUploadUrlPublic);
  const createUsage = useMutation(api.fleetPublic.createUsagePublic);
  const closeUsage = useMutation(api.fleetPublic.closeUsagePublic);

  const [step, setStep] = useState<Step>("select");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const openUsage = useQuery(
    api.fleetPublic.getOpenUsageForVehicle,
    selectedVehicleId ? { vehicleId: selectedVehicleId as Id<"vehicles"> } : "skip"
  );

  const today = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");
  const [dep, setDep] = useState({
    driverName: "", destination: "", purpose: "",
    departureDate: today, departureTime: nowTime, kmDeparture: "", notes: "",
  });
  const [arr, setArr] = useState({
    arrivalDate: today, arrivalTime: nowTime,
    kmArrival: "", fuelCost: "", damages: "", notes: "",
  });
  const [damageFiles, setDamageFiles] = useState<File[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selectedVehicle = vehicles?.find((v) => v._id === selectedVehicleId);

  const handleVehicleConfirm = () => {
    if (!selectedVehicleId) { toast.error("Selecione um veículo"); return; }
    if (openUsage === undefined) return;
    if (openUsage) {
      setStep("vehicle_in_use");
    } else if (selectedVehicle?.status === "em_uso") {
      toast.error("Veículo já está em uso por outro motorista");
    } else {
      setStep("departure");
    }
  };

  const handleDeparture = async () => {
    if (!dep.driverName.trim()) { toast.error("Informe seu nome"); return; }
    if (!dep.kmDeparture) { toast.error("Informe o KM de saída"); return; }
    setSaving(true);
    try {
      await createUsage({
        vehicleId: selectedVehicleId as Id<"vehicles">,
        driverName: dep.driverName.trim(),
        destination: dep.destination || undefined,
        purpose: dep.purpose || undefined,
        departureDate: dep.departureDate,
        departureTime: dep.departureTime,
        kmDeparture: parseFloat(dep.kmDeparture),
        notes: dep.notes || undefined,
      });
      toast.success("Saída registrada!");
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar saída");
    } finally {
      setSaving(false);
    }
  };

  const handleArrival = async () => {
    if (!openUsage) return;
    if (!arr.kmArrival) { toast.error("Informe o KM de chegada"); return; }
    const km = parseFloat(arr.kmArrival);
    if (km < openUsage.kmDeparture) { toast.error("KM de chegada não pode ser menor que o de saída"); return; }
    setSaving(true);
    try {
      const photoIds: string[] = [];
      for (const file of damageFiles) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("Falha ao enviar foto");
        const { storageId } = await res.json() as { storageId: string };
        photoIds.push(storageId);
      }
      await closeUsage({
        id: openUsage._id,
        arrivalDate: arr.arrivalDate,
        arrivalTime: arr.arrivalTime,
        kmArrival: km,
        fuelCost: arr.fuelCost ? parseFloat(arr.fuelCost) : undefined,
        damages: arr.damages || undefined,
        damagePhotoIds: photoIds.length > 0 ? photoIds : undefined,
        notes: arr.notes || undefined,
      });
      toast.success("Chegada registrada!");
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar chegada");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("select");
    setSelectedVehicleId("");
    setDamageFiles([]);
    setArr({ arrivalDate: today, arrivalTime: nowTime, kmArrival: "", fuelCost: "", damages: "", notes: "" });
    setDep({ driverName: "", destination: "", purpose: "", departureDate: today, departureTime: nowTime, kmDeparture: "", notes: "" });
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0f0f0f 0%, #1a1a1a 100%)" }}>
      {/* ── Header ── */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} className="sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-card/10 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-none">Portal do Motorista</p>
              <p className="text-white/40 text-xs leading-none mt-0.5">Parket Expedição</p>
            </div>
          </div>
          <img src="/logo-parket.png" alt="Parket" className="h-6 opacity-70" />
        </div>
      </div>

      {/* ── Install Banner ── */}
      {prompt && !installed && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <button
            onClick={triggerInstall}
            className="w-full cursor-pointer rounded-2xl p-4 flex items-center gap-4 text-left"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <div className="w-10 h-10 rounded-xl bg-card/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Instalar no celular</p>
              <p className="text-blue-200 text-xs mt-0.5">Acesse rapidamente sem abrir o navegador</p>
            </div>
            <Download className="w-5 h-5 text-white/70 shrink-0" />
          </button>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── STEP: SELECT ── */}
        {step === "select" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">Olá, motorista!</h1>
              <p className="text-white/50 text-sm mt-1">Selecione o veículo para registrar saída ou chegada.</p>
            </div>

            {vehicles === undefined ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl opacity-20" />)}
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum veículo disponível.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <button
                    key={v._id}
                    onClick={() => setSelectedVehicleId(v._id)}
                    className={cn(
                      "w-full text-left rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer",
                      selectedVehicleId === v._id
                        ? "ring-2 ring-white/80"
                        : "hover:ring-1 hover:ring-white/20"
                    )}
                    style={{
                      background: selectedVehicleId === v._id ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      v.status === "disponivel" ? "bg-emerald-500/20" : v.status === "em_uso" ? "bg-blue-500/20" : "bg-amber-500/20"
                    )}>
                      <VehicleIcon type={v.type} className={cn(
                        v.status === "disponivel" ? "text-emerald-400" : v.status === "em_uso" ? "text-blue-400" : "text-amber-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-base">{v.plate}</p>
                      <p className="text-sm text-white/50">{v.brand} {v.model} · {TYPE_LABELS[v.type]}</p>
                      {v.currentKm !== undefined && (
                        <p className="text-xs text-white/30 flex items-center gap-1 mt-0.5">
                          <Navigation className="w-3 h-3" /> {v.currentKm.toLocaleString("pt-BR")} km
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        v.status === "disponivel" ? "bg-emerald-500/20 text-emerald-400" :
                        v.status === "em_uso" ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"
                      )}>
                        {v.status === "disponivel" ? "Disponível" : v.status === "em_uso" ? "Em Uso" : "Manutenção"}
                      </span>
                      {selectedVehicleId === v._id && <ChevronRight className="w-4 h-4 text-white/40" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedVehicleId && (
              <Button
                className="w-full bg-card text-black hover:bg-card/90 font-bold h-12 rounded-2xl text-base cursor-pointer"
                onClick={handleVehicleConfirm}
                disabled={openUsage === undefined}
              >
                {openUsage === undefined ? "Verificando..." : "Continuar"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* ── STEP: VEHICLE IN USE ── */}
        {step === "vehicle_in_use" && openUsage && (
          <div className="space-y-5">
            <button onClick={() => setStep("select")} className="flex items-center gap-1 text-sm text-white/50 cursor-pointer hover:text-white/80">
              <ChevronLeft className="w-4 h-4" /> Trocar veículo
            </button>

            <div className="rounded-2xl p-4" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
              <p className="text-xs text-blue-400 uppercase font-semibold tracking-wide mb-1">Veículo em uso</p>
              <p className="font-bold text-white text-lg">{selectedVehicle?.plate} — {selectedVehicle?.brand} {selectedVehicle?.model}</p>
              <p className="text-sm text-white/60 mt-1">Saída: {openUsage.departureDate.split("-").reverse().join("/")} às {openUsage.departureTime}</p>
              <p className="text-sm text-white/60">Motorista: <span className="font-semibold text-white">{openUsage.driverName}</span></p>
              <p className="text-sm text-white/60">KM saída: <span className="font-semibold text-white">{openUsage.kmDeparture.toLocaleString("pt-BR")} km</span></p>
            </div>

            <p className="text-white/70 font-medium text-center">O que deseja fazer?</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep("departure")}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <LogOut className="w-6 h-6 text-orange-400" />
                </div>
                <p className="font-semibold text-sm text-white">Nova Saída</p>
                <p className="text-xs text-white/40 text-center">Registrar outra saída</p>
              </button>
              <button
                onClick={() => setStep("arrival")}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 cursor-pointer"
                style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <div className="w-12 h-12 bg-gray-900/20 rounded-xl flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-foreground" />
                </div>
                <p className="font-semibold text-sm text-foreground">Registrar Chegada</p>
                <p className="text-xs text-muted-foreground text-center">Finalizar uso em aberto</p>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: DEPARTURE ── */}
        {step === "departure" && (
          <div className="space-y-5">
            <button onClick={() => setStep("select")} className="flex items-center gap-1 text-sm text-white/50 cursor-pointer hover:text-white/80">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>

            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Registrar Saída</h2>
              </div>
              <p className="text-sm text-white/40">{selectedVehicle?.plate} — {selectedVehicle?.brand} {selectedVehicle?.model}</p>
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <FieldGroup label="Seu nome completo *">
                <Input className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  placeholder="João da Silva" value={dep.driverName} onChange={(e) => setDep((d) => ({ ...d, driverName: e.target.value }))} />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Data Saída *">
                  <Input type="date" className="bg-card/5 border-white/10 text-white focus-visible:ring-white/30"
                    value={dep.departureDate} onChange={(e) => setDep((d) => ({ ...d, departureDate: e.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Hora Saída *">
                  <Input type="time" className="bg-card/5 border-white/10 text-white focus-visible:ring-white/30"
                    value={dep.departureTime} onChange={(e) => setDep((d) => ({ ...d, departureTime: e.target.value }))} />
                </FieldGroup>
              </div>
              <FieldGroup label="KM no Odômetro (saída) *">
                <Input type="number" placeholder="Ex: 45230"
                  className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  value={dep.kmDeparture} onChange={(e) => setDep((d) => ({ ...d, kmDeparture: e.target.value }))} />
                {selectedVehicle?.currentKm !== undefined && (
                  <p className="text-xs text-white/30">Último KM registrado: {selectedVehicle.currentKm.toLocaleString("pt-BR")} km</p>
                )}
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Destino">
                  <Input placeholder="Cidade / endereço"
                    className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                    value={dep.destination} onChange={(e) => setDep((d) => ({ ...d, destination: e.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Finalidade">
                  <Input placeholder="Entrega, visita..."
                    className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                    value={dep.purpose} onChange={(e) => setDep((d) => ({ ...d, purpose: e.target.value }))} />
                </FieldGroup>
              </div>
              <FieldGroup label="Observações">
                <Textarea placeholder="Informações adicionais..." rows={2}
                  className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  value={dep.notes} onChange={(e) => setDep((d) => ({ ...d, notes: e.target.value }))} />
              </FieldGroup>
            </div>

            <Button
              className="w-full bg-card text-black hover:bg-card/90 font-bold h-12 rounded-2xl text-base cursor-pointer"
              onClick={handleDeparture} disabled={saving}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {saving ? "Registrando..." : "Confirmar Saída"}
            </Button>
          </div>
        )}

        {/* ── STEP: ARRIVAL ── */}
        {step === "arrival" && openUsage && (
          <div className="space-y-5">
            <button onClick={() => setStep("vehicle_in_use")} className="flex items-center gap-1 text-sm text-white/50 cursor-pointer hover:text-white/80">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>

            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-card/10 rounded-xl flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Registrar Chegada</h2>
              </div>
              <p className="text-sm text-white/40">{selectedVehicle?.plate} · Motorista: {openUsage.driverName}</p>
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Data Chegada *">
                  <Input type="date" className="bg-card/5 border-white/10 text-white focus-visible:ring-white/30"
                    value={arr.arrivalDate} onChange={(e) => setArr((a) => ({ ...a, arrivalDate: e.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Hora Chegada *">
                  <Input type="time" className="bg-card/5 border-white/10 text-white focus-visible:ring-white/30"
                    value={arr.arrivalTime} onChange={(e) => setArr((a) => ({ ...a, arrivalTime: e.target.value }))} />
                </FieldGroup>
              </div>
              <FieldGroup label="KM no Odômetro (chegada) *">
                <Input type="number" placeholder="Ex: 45580"
                  className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  value={arr.kmArrival} onChange={(e) => setArr((a) => ({ ...a, kmArrival: e.target.value }))} />
                <p className="text-xs text-white/30">KM saída: {openUsage.kmDeparture.toLocaleString("pt-BR")} km</p>
              </FieldGroup>
              <FieldGroup label="Custo com Combustível (R$)">
                <Input type="number" step="0.01" placeholder="0,00"
                  className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  value={arr.fuelCost} onChange={(e) => setArr((a) => ({ ...a, fuelCost: e.target.value }))} />
              </FieldGroup>

              <div className="space-y-2 pt-1 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <Label className="text-sm font-semibold text-white">Avarias / Danos</Label>
                </div>
                <Textarea
                  placeholder="Descreva qualquer avaria ou dano encontrado..."
                  rows={3}
                  className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  value={arr.damages}
                  onChange={(e) => setArr((a) => ({ ...a, damages: e.target.value }))}
                />
                {damageFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {damageFiles.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-card/10">
                        <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setDamageFiles((prev) => prev.filter((_, i) => i !== idx))}
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
                  className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 cursor-pointer transition-colors"
                  style={{ border: "2px dashed rgba(255,255,255,0.15)" }}
                >
                  <Camera className="w-4 h-4" /> Adicionar foto da avaria
                </button>
                <input
                  ref={photoInputRef}
                  type="file" accept="image/*" multiple capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setDamageFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </div>

              <FieldGroup label="Observações">
                <Textarea placeholder="Informações adicionais..." rows={2}
                  className="bg-card/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  value={arr.notes} onChange={(e) => setArr((a) => ({ ...a, notes: e.target.value }))} />
              </FieldGroup>
            </div>

            <Button
              className="w-full bg-card text-black hover:bg-card/90 font-bold h-12 rounded-2xl text-base cursor-pointer"
              onClick={handleArrival} disabled={saving}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {saving ? "Registrando..." : "Confirmar Chegada"}
            </Button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.2)", border: "2px solid rgba(16,185,129,0.4)" }}>
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Registrado!</h2>
              <p className="text-white/50 mt-1">Registro salvo com sucesso.</p>
            </div>
            <button
              onClick={reset}
              className="px-6 py-3 rounded-2xl text-sm font-semibold text-white cursor-pointer transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Fazer outro registro
            </button>
          </div>
        )}

        <p className="text-center text-xs text-white/20 pt-6 pb-4">
          Parket Expedição · {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-white/50 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}
