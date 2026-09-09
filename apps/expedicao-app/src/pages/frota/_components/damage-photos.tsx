import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useState } from "react";
import { X } from "lucide-react";

type Props = { storageIds: string[] };

export function DamagePhotos({ storageIds }: Props) {
  const urls = useQuery(api.fleet.getUsagePhotoUrls, { storageIds });
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!urls) {
    return (
      <div className="flex gap-2 flex-wrap mt-1">
        {storageIds.map((_, i) => <Skeleton key={i} className="w-16 h-16 rounded-lg" />)}
      </div>
    );
  }

  if (urls.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 flex-wrap mt-1">
        {urls.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(url)}
            className="w-16 h-16 rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img src={url} alt={`Avaria ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1.5 cursor-pointer hover:bg-black/80"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="Foto da avaria"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
