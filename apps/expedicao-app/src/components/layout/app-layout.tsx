import { Outlet } from "react-router-dom";
import { SidebarNav } from "./sidebar-nav.tsx";
import { MobileSidebar } from "./mobile-sidebar.tsx";
import { DadaChat } from "@/components/dada/dada-chat.tsx";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="print:hidden">
        <SidebarNav />
      </div>

      {/* Mobile top bar + slide-in sidebar */}
      <div className="print:hidden">
        <MobileSidebar />
      </div>

      {/* Main content — top padding for fixed mobile header */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
        <Outlet />
      </main>

      {/* Dadá - Assistente Operacional */}
      <DadaChat />
    </div>
  );
}
