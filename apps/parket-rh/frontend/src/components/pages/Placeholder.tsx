import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <Card className="p-12 flex flex-col items-center text-center">
        <Construction size={32} className="text-primary mb-3" />
        <div className="font-semibold mb-1.5">Em construção</div>
        <p className="text-sm text-muted-foreground max-w-md">
          Esta área será implementada nas próximas fases. Volte em breve!
        </p>
      </Card>
    </div>
  );
}
