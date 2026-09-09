import React from "react";
import { Presentation } from "../components/presentation";
import { socialMediaSlides } from "../components/social-media-slides-data";

export function SocialMediaPage() {
  return (
    <div className="w-full h-screen bg-[#0A0A0A]">
      <Presentation slides={socialMediaSlides} backLink={{ label: "Hub", href: "/" }} />
    </div>
  );
}
