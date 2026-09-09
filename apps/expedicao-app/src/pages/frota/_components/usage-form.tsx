import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { Camera, X, ImagePlus, Loader2 } from "lucide-react";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";

const departureSchema = z.object({
  vehicleId: z.string().min(1, "Selecione o veículo"),
  driverName: z.string().min(1, "Nome do motorista obrigatório"),
  destination: z.string().optional(),
  purpose: z.string().optional(),
  departureDate: z.string().min(1, "Data obrigatória"),
  departureTime: z.string().min(1, "Hora obrigatória"),
  kmDeparture: z.coerce.number().min(0, "KM inválido"),
  notes: z.string().optional(),
});

const arrivalSchema = z.object({
  arrivalDate: z.string().min(1, "Data obrigatória"),
  arrivalTime: z.string().min(1, "Hora obrigatória"),
  kmArrival: z.coerce.number().min(0, "KM inválido"),
  fuelCost: z.coerce.number().min(0).optional(),
  damages: z.string().optional(),
  notes: z.string().optional(),
});

type DepartureData = z.infer<typeof departureSchema>;
type ArrivalData = z.infer<typeof arrivalSchema>;

type Props = {
  mode: "departure" | "arrival";
  usage?: Doc<"vehicleUsage"> & { vehicle?: Doc<"vehicles"> | null };
  onSuccess: () => void;
};

// ─── Photo uploader component ────────────────────────────────────────────────
type PhotoPreview = { file: File; previewUrl: string; storageId?: string };

function DamagePhotoUploader({
  photos,
  onChange,
}: {
  photos: PhotoPreview[];
  onChange: (photos: PhotoPreview[]) => void;
}) {
  const generateUploadUrl = useMutation(api.fleet.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newPhotos: PhotoPreview[] = [];
    try {
      for (const file of Array.from(files)) {
        const previewUrl = URL.createObjectURL(file);
        // Upload immediately
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Falha no upload");
        const { storageId } = await res.json() as { storageId: string };
        newPhotos.push({ file, previewUrl, storageId });
      }
      onChange([...photos, ...newPhotos]);
    } catch {
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {/* Previews */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
              <img src={p.previewUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              {!p.storageId && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-3 flex items-center gap-2 cursor-pointer transition-colors",
          "hover:border-primary hover:bg-primary/5",
          uploading && "pointer-events-none opacity-60"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground">
          {uploading ? "Enviando..." : "Adicionar foto(s) da avaria"}
        </span>
        <Camera className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────
export function UsageForm({ mode, usage, onSuccess }: Props) {
  const create = useMutation(api.fleet.createUsage);
  const close = useMutation(api.fleet.closeUsage);
  const vehicles = useQuery(api.fleet.listVehicles, mode === "departure" ? { status: "disponivel" } : {});

  const [damagePhotos, setDamagePhotos] = useState<PhotoPreview[]>([]);

  const today = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");

  const departureForm = useForm<DepartureData>({
    resolver: zodResolver(departureSchema),
    defaultValues: {
      departureDate: today,
      departureTime: nowTime,
      vehicleId: usage?.vehicleId ?? "",
    },
  });

  const arrivalForm = useForm<ArrivalData>({
    resolver: zodResolver(arrivalSchema),
    defaultValues: {
      arrivalDate: today,
      arrivalTime: nowTime,
    },
  });

  const onDeparture = async (data: DepartureData) => {
    try {
      await create({ ...data, vehicleId: data.vehicleId as Id<"vehicles"> });
      toast.success("Saída registrada!");
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar saída");
    }
  };

  const onArrival = async (data: ArrivalData) => {
    if (!usage) return;
    // Ensure all photos are uploaded
    const pending = damagePhotos.filter((p) => !p.storageId);
    if (pending.length > 0) {
      toast.error("Aguarde o upload das fotos terminar");
      return;
    }
    try {
      const storageIds = damagePhotos.map((p) => p.storageId!);
      await close({
        id: usage._id,
        ...data,
        damagePhotoIds: storageIds.length > 0 ? storageIds : undefined,
      });
      toast.success("Chegada registrada!");
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar chegada");
    }
  };

  if (mode === "departure") {
    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = departureForm;
    const vehicleId = watch("vehicleId");
    return (
      <form onSubmit={handleSubmit(onDeparture)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Veículo *</Label>
          <Select value={vehicleId} onValueChange={(v) => setValue("vehicleId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
            <SelectContent>
              {vehicles?.map((v) => (
                <SelectItem key={v._id} value={v._id}>
                  {v.plate} — {v.brand} {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.vehicleId && <p className="text-xs text-destructive">{errors.vehicleId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Motorista *</Label>
          <Input {...register("driverName")} placeholder="Nome completo" />
          {errors.driverName && <p className="text-xs text-destructive">{errors.driverName.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Input {...register("destination")} placeholder="Cidade / endereço" />
          </div>
          <div className="space-y-1.5">
            <Label>Finalidade</Label>
            <Input {...register("purpose")} placeholder="Entrega, visita..." />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Data Saída *</Label>
            <Input {...register("departureDate")} type="date" />
            {errors.departureDate && <p className="text-xs text-destructive">{errors.departureDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Hora Saída *</Label>
            <Input {...register("departureTime")} type="time" />
          </div>
          <div className="space-y-1.5">
            <Label>KM Saída *</Label>
            <Input {...register("kmDeparture")} type="number" placeholder="0" />
            {errors.kmDeparture && <p className="text-xs text-destructive">{errors.kmDeparture.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea {...register("notes")} rows={2} placeholder="Informações adicionais..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onSuccess}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar Saída"}
          </Button>
        </div>
      </form>
    );
  }

  // Arrival mode
  const { register, handleSubmit, watch: watchArrival, formState: { errors, isSubmitting } } = arrivalForm;
  const kmArrivalVal = watchArrival("kmArrival");
  const kmDriven = usage && kmArrivalVal ? Number(kmArrivalVal) - usage.kmDeparture : null;
  const damagesVal = watchArrival("damages");

  return (
    <form onSubmit={handleSubmit(onArrival)} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      {usage?.vehicle && (
        <div className="bg-muted rounded-lg px-4 py-3 text-sm">
          <p className="font-medium">{usage.vehicle.plate} — {usage.vehicle.brand} {usage.vehicle.model}</p>
          <p className="text-muted-foreground">Motorista: {usage.driverName} · Saiu às {usage.departureTime} · KM saída: {usage.kmDeparture.toLocaleString("pt-BR")}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Data Chegada *</Label>
          <Input {...register("arrivalDate")} type="date" />
          {errors.arrivalDate && <p className="text-xs text-destructive">{errors.arrivalDate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Hora Chegada *</Label>
          <Input {...register("arrivalTime")} type="time" />
        </div>
        <div className="space-y-1.5">
          <Label>KM Chegada *</Label>
          <Input {...register("kmArrival")} type="number" placeholder="0" />
          {errors.kmArrival && <p className="text-xs text-destructive">{errors.kmArrival.message}</p>}
        </div>
      </div>

      {kmDriven !== null && kmDriven >= 0 && (
        <div className="bg-green-500/10 dark:bg-green-950 border border-green-500/30 dark:border-green-800 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
          <span className="text-green-400 dark:text-green-400 font-semibold">
            ✓ {kmDriven.toLocaleString("pt-BR")} km percorridos nesta viagem
          </span>
        </div>
      )}
      {kmDriven !== null && kmDriven < 0 && (
        <p className="text-xs text-destructive">KM de chegada não pode ser menor que o de saída ({usage?.kmDeparture.toLocaleString("pt-BR")} km)</p>
      )}

      <div className="space-y-1.5">
        <Label>Custo Combustível (R$)</Label>
        <Input {...register("fuelCost")} type="number" step="0.01" placeholder="0,00" />
      </div>

      {/* Avarias + fotos */}
      <div className="space-y-2 rounded-lg border border-orange-500/30 dark:border-orange-900 p-3 bg-orange-500/10/50 dark:bg-orange-950/20">
        <Label className="text-orange-400 dark:text-orange-400 font-semibold flex items-center gap-1.5">
          ⚠ Avarias / Ocorrências
        </Label>
        <Textarea
          {...register("damages")}
          rows={2}
          placeholder="Descreva qualquer avaria, batida, arranhão..."
          className="bg-background"
        />
        {/* Only show photo uploader if there is damage text */}
        {damagesVal && damagesVal.trim().length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Fotos da avaria</Label>
            <DamagePhotoUploader photos={damagePhotos} onChange={setDamagePhotos} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea {...register("notes")} rows={2} placeholder="Informações adicionais..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registrando..." : "Registrar Chegada"}
        </Button>
      </div>
    </form>
  );
}
