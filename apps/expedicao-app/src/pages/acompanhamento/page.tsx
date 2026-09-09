import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Search, MapPin, Truck, Package, FileText, PackageSearch, PackageCheck, Navigation, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDebounce } from "@/hooks/use-debounce.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { motion, AnimatePresence } from "motion/react";

const statusConfig = {
  rascunho:     { label: "Rascunho",      icon: FileText,       className: "bg-muted text-muted-foreground border-gray-200" },
  confirmado:   { label: "Confirmado",    icon: PackageSearch,  className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  em_separacao: { label: "Em Separação",  icon: PackageCheck,   className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  em_rota:      { label: "Em Rota",       icon: Navigation,     className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  entregue:     { label: "Entregue",      icon: CheckCircle2,   className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelado:    { label: "Cancelado",     icon: XCircle,        className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
  retirada: "Retirada",
};

export default function AcompanhamentoPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const orders = useQuery(
    api.orders.listOrdersPublic,
    { search: debouncedSearch || undefined }
  );

  return (
    <div className="min-h-screen bg-muted">
      {/* Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-card"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <motion.img
              src="/logo-parket.png"
              alt="Parket"
              className="w-48"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] as const }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <img
            src="/logo-parket.png"
            alt="Parket"
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">Acompanhamento de Pedidos</span>
        </div>
      </div>

      <motion.div
        className="max-w-2xl mx-auto px-4 py-6 space-y-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: showSplash ? 0 : 1, y: showSplash ? 16 : 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Busque pelo número do pedido ou nome do cliente</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-card"
            placeholder="Buscar por número ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        {orders === undefined ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Package className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground font-medium">Nenhum pedido encontrado</p>
            {search && <p className="text-muted-foreground text-sm">Tente buscar com outro termo</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const cfg = statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.rascunho;
              const StatusIcon = cfg.icon;
              return (
                <button
                  key={order._id}
                  onClick={() => navigate(`/pedido/${encodeURIComponent(order._id as Id<"orders">)}`)}
                  className="w-full text-left bg-card rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${cfg.className}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">{order.orderNumber}</span>
                          <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground/80 mt-0.5 truncate">{order.clientName}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {order.clientCity && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {order.clientCity}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Truck className="w-3 h-3" />
                            {freightLabels[order.freightType] ?? order.freightType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.itemCount} item(s)
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.creationTime), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {order.scheduledDate && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Previsão</p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {format(new Date(order.scheduledDate + "T00:00:00"), "dd/MM", { locale: ptBR })}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">Parket · Gestão de Pedidos</p>
      </motion.div>
    </div>
  );
}
