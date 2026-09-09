import { useState, useEffect } from "react";
import { Outlet } from "react-router";
import { HeroFloatingBar } from "./HeroFloatingBar";
import { LeadFormModal } from "./LeadFormModal";
import { LEAD_FORM_EVENT } from "../lib/leadForm";

export function RootLayout() {
  const [formOpen, setFormOpen] = useState(false);

  // Listener global — qualquer componente que disparar `pkt:open-lead-form`
  // (via openLeadForm()) abre o popup.
  useEffect(() => {
    const handler = () => setFormOpen(true);
    window.addEventListener(LEAD_FORM_EVENT, handler);
    return () => window.removeEventListener(LEAD_FORM_EVENT, handler);
  }, []);

  return (
    <>
      <Outlet />
      <HeroFloatingBar onOpenForm={() => setFormOpen(true)} />
      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}
