// Compatibilidade: agora o LeadFormModal é apenas um wrapper que reusa o
// LeadFormMultiStep em modo popup. Mantém a mesma API ({open, onClose}) pra
// não precisar tocar em nenhum botão/CTA que já o chama.
import { LeadFormMultiStep } from "./LeadFormMultiStep";

interface LeadFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function LeadFormModal({ open, onClose }: LeadFormModalProps) {
  return <LeadFormMultiStep asModal open={open} onClose={onClose} />;
}

export default LeadFormModal;
