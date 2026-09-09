import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Printer, ArrowLeft, Package, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Item = { descricao: string; quantidade: string; unidade: string; m2: string };

const emptyItem = (): Item => ({ descricao: "", quantidade: "", unidade: "CX", m2: "" });

export default function EtiquetaBrancoPage() {
  const navigate = useNavigate();

  const [destinatario, setDestinatario] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [pedido, setPedido] = useState("");
  const [frete, setFrete] = useState("Frete Interno");
  const [previsao, setPrevisao] = useState("");
  const [volumes, setVolumes] = useState("1");
  const [totalM2, setTotalM2] = useState("");
  const [obs, setObs] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const setItem = (i: number, k: keyof Item, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <span className="text-sm text-gray-500 flex-1">Etiqueta em Branco</span>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="w-4 h-4 mr-2" /> Imprimir Etiqueta
        </Button>
      </div>

      <div className="print:hidden max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide">Preencha os dados</h2>

        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Destinatário *</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Nome completo" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Telefone</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Nº Pedido</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="PED-0001" value={pedido} onChange={(e) => setPedido(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Endereço de Entrega</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Rua, número, bairro..." value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Cidade / Estado</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="São Paulo — SP" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Frete</label>
              <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                value={frete} onChange={(e) => setFrete(e.target.value)}>
                <option>Frete Interno</option>
                <option>Frete Terceiro</option>
                <option>Retirada pelo Cliente</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Previsão de Entrega</label>
              <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Volumes</label>
              <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                min={1} value={volumes} onChange={(e) => setVolumes(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Total m²</label>
              <input type="number" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="0.00" value={totalM2} onChange={(e) => setTotalM2(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Produtos</h3>
            <Button size="sm" variant="secondary" onClick={addItem}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-5 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Descrição do produto" value={item.descricao} onChange={(e) => setItem(i, "descricao", e.target.value)} />
              <input className="col-span-2 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 text-center"
                placeholder="Qtd" type="number" value={item.quantidade} onChange={(e) => setItem(i, "quantidade", e.target.value)} />
              <input className="col-span-2 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 text-center uppercase"
                placeholder="UN" value={item.unidade} onChange={(e) => setItem(i, "unidade", e.target.value)} />
              <input className="col-span-2 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 text-right"
                placeholder="m²" type="number" step="0.01" value={item.m2} onChange={(e) => setItem(i, "m2", e.target.value)} />
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="col-span-1 text-red-400 hover:text-red-600 cursor-pointer flex justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-gray-400">Colunas: Descrição · Qtd · Unid. · m²</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-xs font-semibold text-gray-500 uppercase">Observações</label>
          <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            rows={2} placeholder="Informações adicionais..." value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
      </div>

      {/* ── PRINTABLE LABEL ── */}
      <div className="p-8 print:p-0 flex justify-center">
        <div
          id="etiqueta-print"
          className="bg-white shadow-lg print:shadow-none w-full max-w-2xl"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-4 border-black px-6 py-4">
            <img src="/logo-parket.png" alt="Parket" className="h-12 object-contain" />
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Pedido</div>
              <div className="text-3xl font-black text-black">{pedido || "___________"}</div>
            </div>
          </div>

          {/* Destinatário */}
          <div className="px-6 py-4 border-b-2 border-gray-300">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Destinatário</div>
            <div className="text-2xl font-black text-black uppercase leading-tight min-h-[2rem]">
              {destinatario || <span className="text-gray-300">NOME DO DESTINATÁRIO</span>}
            </div>
            {telefone && <div className="text-sm text-gray-600 mt-1">📞 {telefone}</div>}
          </div>

          {/* Endereço */}
          <div className="px-6 py-4 border-b-2 border-gray-300">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Endereço de Entrega</div>
            <div className="text-base font-semibold text-black min-h-[1.5rem]">
              {endereco || <span className="text-gray-300">Endereço não informado</span>}
            </div>
            {cidade && <div className="text-sm text-gray-700 mt-0.5">{cidade}</div>}
          </div>

          {/* Produtos */}
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
                {items.filter((it) => it.descricao || it.quantidade).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 font-medium text-black">{item.descricao || "—"}</td>
                    <td className="py-1.5 text-center font-bold text-lg text-black">{item.quantidade || "—"}</td>
                    <td className="py-1.5 text-center text-gray-600 uppercase">{item.unidade}</td>
                    <td className="py-1.5 text-right text-gray-700">{item.m2 ? `${parseFloat(item.m2).toFixed(2)} m²` : "—"}</td>
                  </tr>
                ))}
                {items.every((it) => !it.descricao && !it.quantidade) && (
                  <tr><td colSpan={4} className="py-3 text-center text-gray-300 text-sm">Nenhum produto informado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Resumo */}
          <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-500" />
              <div>
                <div className="text-xs text-gray-500 uppercase">Volumes</div>
                <div className="text-2xl font-black text-black">{volumes || "—"}</div>
              </div>
            </div>
            {totalM2 && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Total m²</div>
                <div className="text-2xl font-black text-black">{parseFloat(totalM2).toFixed(2)} m²</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 uppercase">Frete</div>
              <div className="text-base font-bold text-black">{frete}</div>
            </div>
            {previsao && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Previsão</div>
                <div className="text-base font-bold text-black">
                  {format(new Date(previsao + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          {obs && (
            <div className="px-6 py-3 border-b-2 border-gray-300 bg-yellow-50">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Observações</div>
              <div className="text-sm text-gray-800">{obs}</div>
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
