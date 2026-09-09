import React from "react";
import { Presentation } from "../components/presentation";
import { workflowPlaybookSlides } from "../components/workflow-playbook-slides-data";

export function WorkflowPlaybookPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={workflowPlaybookSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
