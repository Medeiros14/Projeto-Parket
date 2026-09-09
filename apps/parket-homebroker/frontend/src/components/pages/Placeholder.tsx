export function PlaceholderPage({ title, fase }: { title: string; fase?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-hb-textDim">
      <div className="text-4xl mb-3">📊</div>
      <div className="text-base font-semibold text-hb-text">{title}</div>
      {fase && <div className="text-[11px] text-hb-textDim mt-1">{fase}</div>}
      <div className="text-[10px] text-hb-textDim mt-3 max-w-md text-center">
        Esta tela faz parte de uma fase futura da entrega do Home Broker. Vamos liberar progressivamente conforme as fases forem aprovadas.
      </div>
    </div>
  );
}
