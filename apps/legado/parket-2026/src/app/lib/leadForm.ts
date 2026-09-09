// Helper global pra abrir o formulário multi-step de qualquer componente,
// sem precisar passar props pelo árvore. O RootLayout escuta o evento e abre.
export const LEAD_FORM_EVENT = "pkt:open-lead-form";

export function openLeadForm() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LEAD_FORM_EVENT));
  }
}

/** Handler pronto pra usar em onClick: e.preventDefault() + abre o form */
export function handleLeadFormClick(e?: React.MouseEvent) {
  if (e && e.preventDefault) e.preventDefault();
  openLeadForm();
}
