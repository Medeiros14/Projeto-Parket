import { Construction } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="text-xs text-parket-textDim mt-1">{description}</p>}
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl p-12 flex flex-col items-center text-center">
        <Construction size={32} className="text-parket-accent mb-3" />
        <h2 className="text-sm font-semibold mb-1.5">Em construção</h2>
        <p className="text-xs text-parket-textDim max-w-md">
          Esta área será implementada nas próximas fases do roadmap.
        </p>
      </div>
    </div>
  );
}
