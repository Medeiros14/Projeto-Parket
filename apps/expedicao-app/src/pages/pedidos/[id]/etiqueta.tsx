import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Printer, ArrowLeft, Package, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

const freightLabels: Record<string, string> = {
  interno: "Frete Interno",
  terceiro: "Frete Terceiro",
  retirada: "Retirada pelo Cliente",
};

export default function EtiquetaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useQuery(api.orders.getOrder, { id: id as Id<"orders"> });
  const [customVolumes, setCustomVolumes] = useState<number | null>(null);

  if (order === undefined) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center text-gray-500">Pedido não encontrado.</div>
    );
  }

  const calculatedVolumes = order.items.reduce((sum, item) => sum + Math.ceil(item.quantity), 0);
  const totalVolumes = customVolumes ?? calculatedVolumes;
  const totalM2 = order.items.reduce((sum, item) => {
    if (item.m2PerBox) return sum + item.quantity * item.m2PerBox;
    return sum;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden bg-white border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/pedidos/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <span className="text-sm text-gray-500 flex-1">Etiqueta de Palete — {order.orderNumber}</span>
        <Button variant="secondary" onClick={() => navigate("/etiqueta-branco")} size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Etiqueta em Branco
        </Button>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir Etiqueta
        </Button>
      </div>

      {/* Label preview */}
      <div className="p-8 print:p-0 flex justify-center">
        <div
          id="etiqueta-print"
          className="bg-white shadow-lg print:shadow-none w-full max-w-2xl"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {/* Header with logo + order number */}
          <div className="flex items-center justify-between border-b-4 border-black px-6 py-4">
            <img
              src="/logo-parket.png"
              alt="Parket"
              className="h-12 object-contain"
            />
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Pedido</div>
              <div className="text-3xl font-black text-black">{order.orderNumber}</div>
            </div>
          </div>

          {/* Client section */}
          <div className="px-6 py-4 border-b-2 border-gray-300">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Destinatário</div>
            <div className="text-2xl font-black text-black uppercase leading-tight">
              {order.client?.name ?? "—"}
            </div>
            {order.client?.phone && (
              <div className="text-sm text-gray-600 mt-1">📞 {order.client.phone}</div>
            )}
          </div>

          {/* Address section */}
          <div className="px-6 py-4 border-b-2 border-gray-300">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Endereço de Entrega</div>
            <div className="text-base font-semibold text-black">
              {order.deliveryAddress ?? order.client?.address ?? "Endereço não informado"}
            </div>
            {(order.client?.city || order.client?.state) && (
              <div className="text-sm text-gray-700 mt-0.5">
                {[order.client?.city, order.client?.state].filter(Boolean).join(" — ")}
              </div>
            )}
          </div>

          {/* Products table */}
          <div className="px-6 py-4 border-b-2 border-gray-300">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Conteúdo do Palete</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1 font-bold text-gray-700">Produto</th>
                  <th className="text-center py-1 font-bold text-gray-700 w-20">Qtd</th>
                  <th className="text-center py-1 font-bold text-gray-700 w-24">Unid.</th>
                  <th className="text-right py-1 font-bold text-gray-700 w-24">m²</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item._id} className="border-b border-gray-100">
                    <td className="py-1.5 font-medium text-black">
                      <div>{item.productName}</div>
                      <div className="text-xs text-gray-400">{item.productCode}</div>
                    </td>
                    <td className="py-1.5 text-center font-bold text-lg text-black">{item.quantity}</td>
                    <td className="py-1.5 text-center text-gray-600 uppercase">{item.productUnit}</td>
                    <td className="py-1.5 text-right text-gray-700">
                      {item.m2PerBox
                        ? `${(item.quantity * item.m2PerBox).toFixed(2)} m²`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary row */}
          <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-500" />
              <div>
                <div className="text-xs text-gray-500 uppercase">Volumes</div>
                <div className="print:hidden flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    min={1}
                    value={totalVolumes}
                    onChange={(e) => setCustomVolumes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-2xl font-black text-black border-b-2 border-black bg-transparent focus:outline-none text-center"
                  />
                </div>
                <div className="hidden print:block text-2xl font-black text-black">{totalVolumes}</div>
              </div>
            </div>
            {totalM2 > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Total m²</div>
                <div className="text-2xl font-black text-black">{totalM2.toFixed(2)} m²</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 uppercase">Frete</div>
              <div className="text-base font-bold text-black">{freightLabels[order.freightType] ?? order.freightType}</div>
            </div>
            {order.scheduledDate && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Previsão</div>
                <div className="text-base font-bold text-black">
                  {format(new Date(order.scheduledDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="px-6 py-3 border-b-2 border-gray-300 bg-yellow-50">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Observações</div>
              <div className="text-sm text-gray-800">{order.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 flex items-center justify-between text-xs text-gray-400">
            <span>Expedição Parket</span>
            <span>expedicao.parket.works</span>
            <span>{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; background: white; }
          .print\\:hidden { display: none !important; }
          #etiqueta-print { box-shadow: none; max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
