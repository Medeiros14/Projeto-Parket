import React from "react";
import { Presentation } from "../components/presentation";
import { playbookIASlides } from "../components/playbook-ia-slides-data";

export function PlaybookIAPage() {
  return (
    <Presentation
      slides={playbookIASlides}
      backLink={{ label: "Hub", href: "/" }}
    />
  );
}
