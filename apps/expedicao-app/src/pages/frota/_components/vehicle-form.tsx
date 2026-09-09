import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

const schema = z.object({
  plate: z.string().min(7, "Placa inválida"),
  model: z.string().min(1, "Modelo obrigatório"),
  brand: z.string().min(1, "Marca obrigatória"),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  type: z.enum(["carro", "caminhao", "van", "moto"]),
  color: z.string().optional(),
  currentKm: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  vehicle?: Doc<"vehicles">;
  onSuccess: () => void;
};

export function VehicleForm({ vehicle, onSuccess }: Props) {
  const create = useMutation(api.fleet.createVehicle);
  const update = useMutation(api.fleet.updateVehicle);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: vehicle ? {
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand,
      year: vehicle.year,
      type: vehicle.type,
      color: vehicle.color ?? "",
      currentKm: vehicle.currentKm,
      notes: vehicle.notes ?? "",
    } : { type: "carro" },
  });

  const type = watch("type");

  const onSubmit = async (data: FormData) => {
    try {
      if (vehicle) {
        await update({ id: vehicle._id, ...data });
        toast.success("Veículo atualizado!");
      } else {
        await create(data);
        toast.success("Veículo cadastrado!");
      }
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar veículo");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Placa *</Label>
          <Input {...register("plate")} placeholder="ABC-1234" className="uppercase" />
          {errors.plate && <p className="text-xs text-destructive">{errors.plate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Tipo *</Label>
          <Select value={type} onValueChange={(v) => setValue("type", v as FormData["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="carro">Carro</SelectItem>
              <SelectItem value="caminhao">Caminhão</SelectItem>
              <SelectItem value="van">Van</SelectItem>
              <SelectItem value="moto">Moto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Marca *</Label>
          <Input {...register("brand")} placeholder="Ford, Mercedes..." />
          {errors.brand && <p className="text-xs text-destructive">{errors.brand.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Modelo *</Label>
          <Input {...register("model")} placeholder="Cargo 816, Transit..." />
          {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Input {...register("year")} type="number" placeholder="2020" />
        </div>
        <div className="space-y-1.5">
          <Label>Cor</Label>
          <Input {...register("color")} placeholder="Branco" />
        </div>
        <div className="space-y-1.5">
          <Label>KM Atual</Label>
          <Input {...register("currentKm")} type="number" placeholder="0" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea {...register("notes")} placeholder="Informações adicionais..." rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : vehicle ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
