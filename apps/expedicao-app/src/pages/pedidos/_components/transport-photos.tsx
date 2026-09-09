import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Camera,
  Upload,
  Trash2,
  ZoomIn,
  ArrowUpFromLine,
  ArrowDownToLine,
  ImageIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const photoTypeConfig = {
  retirada: {
    label: "Retirada",
    icon: ArrowUpFromLine,
    color: "bg-blue-500/15 text-blue-400",
  },
  entrega: {
    label: "Entrega",
    icon: ArrowDownToLine,
    color: "bg-emerald-500/15 text-emerald-400",
  },
  outros: {
    label: "Outros",
    icon: ImageIcon,
    color: "bg-muted text-muted-foreground",
  },
};

type PhotoType = keyof typeof photoTypeConfig;

interface TransportPhotosProps {
  transportId: Id<"toolTransports">;
  direction: "retirar" | "entregar";
}

export function TransportPhotos({ transportId, direction }: TransportPhotosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.toolTransportPhotos.generateUploadUrl);
  const addPhoto = useMutation(api.toolTransportPhotos.addPhoto);
  const deletePhoto = useMutation(api.toolTransportPhotos.deletePhoto);
  const photos = useQuery(api.toolTransportPhotos.getPhotos, { transportId });

  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState<PhotoType>(
    direction === "retirar" ? "retirada" : "entrega"
  );
  const [caption, setCaption] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Apenas imagens são permitidas");
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: muito grande (máx. 10MB)`);

    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) throw new Error("Falha no upload");
    const { storageId } = (await result.json()) as { storageId: string };

    await addPhoto({
      transportId,
      storageId,
      type: photoType,
      caption: caption.trim() || undefined,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    let ok = 0;
    const errors: string[] = [];
    for (const file of files) {
      try {
        await uploadFile(file);
        ok++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Erro ao enviar foto");
      }
    }
    setUploading(false);
    if (ok > 0) {
      setCaption("");
      toast.success(ok === 1 ? "Foto adicionada!" : `${ok} fotos adicionadas!`);
    }
    if (errors.length > 0) {
      toast.error(`${errors.length} foto(s) falharam: ${errors[0]}`);
    }
  };

  const handleDelete = async (id: Id<"toolTransportPhotos">) => {
    try {
      await deletePhoto({ id });
      toast.success("Foto removida");
    } catch {
      toast.error("Erro ao remover foto");
    }
  };

  const grouped = photos?.reduce<Partial<Record<PhotoType, typeof photos>>>(
    (acc, p) => {
      const t = p.type as PhotoType;
      if (!acc[t]) acc[t] = [];
      acc[t]!.push(p);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
        <p className="text-sm font-semibold">Adicionar Foto</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={photoType}
              onValueChange={(v) => setPhotoType(v as PhotoType)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retirada">Retirada</SelectItem>
                <SelectItem value="entrega">Entrega</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Legenda (opcional)</Label>
            <Input
              className="h-9 text-sm"
              placeholder="Ex: Ferramentas retiradas..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 cursor-pointer h-10"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Enviando..." : "Enviar Arquivo"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 cursor-pointer h-10"
            disabled={uploading}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="w-4 h-4 mr-2" />
            {uploading ? "Enviando..." : "Tirar Foto"}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Gallery grouped by type */}
      {photos === undefined ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma foto adicionada</p>
        </div>
      ) : (
        Object.entries(photoTypeConfig).map(([type, cfg]) => {
          const typePhotos = grouped?.[type as PhotoType] ?? [];
          if (typePhotos.length === 0) return null;
          const Icon = cfg.icon;
          return (
            <div key={type} className="space-y-2">
              <div
                className={`flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-full w-fit ${cfg.color}`}
              >
                <Icon className="w-3 h-3" />
                {cfg.label} ({typePhotos.length})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {typePhotos.map((photo) => (
                  <div
                    key={photo._id}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-muted border"
                  >
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.caption ?? cfg.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {photo.url && (
                        <button
                          onClick={() => setLightboxUrl(photo.url!)}
                          className="p-1.5 bg-card/20 rounded-full hover:bg-card/40 transition-colors cursor-pointer"
                        >
                          <ZoomIn className="w-4 h-4 text-white" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(photo._id)}
                        className="p-1.5 bg-red-500/80 rounded-full hover:bg-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                        <p className="text-white text-[10px] truncate">{photo.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {typePhotos[0] && (
                <p className="text-[10px] text-muted-foreground px-1">
                  Por {typePhotos[0].userName} ·{" "}
                  {format(new Date(typePhotos[0]._creationTime), "dd/MM/yy HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>
          );
        })
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar Foto</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-2 right-2 z-10 p-1.5 bg-black/40 rounded-full text-white hover:bg-black/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Foto ampliada"
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
