import React from "react";
import { Presentation } from "../components/presentation";
import { enterpriseOsSlides } from "../components/enterprise-os-slides-data";

export function EnterpriseOsPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={enterpriseOsSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
