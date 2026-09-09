import { useState, useEffect,  } from "react";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { LeadFormMultiStep } from "../components/LeadFormMultiStep";
import { ProductsCTA } from "../components/ProductsCTA";
import { Categories } from "../components/Categories";
import { Pisos } from "../components/Pisos";
import { Decks } from "../components/Decks";
import { Forros } from "../components/Forros";
import { Revestimentos } from "../components/Revestimentos";
import { Inspiracao } from "../components/Inspiracao";
import { Philosophy } from "../components/Philosophy";
import { About } from "../components/About";
import { Testimonial } from "../components/Testimonial";
import { Contact } from "../components/Contact";
import { Footer } from "../components/Footer";
import { Blog } from "../components/Blog";
import { LeadFormModal } from "../components/LeadFormModal";
import { ZoomImage } from "../components/ZoomImage";

export function Home() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div
      className="w-full min-h-screen bg-[#FAF8F5] relative"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <Header />
      <Hero />
      <LeadFormMultiStep />
      <ProductsCTA />
      <Categories />
      <Revestimentos />
      <Pisos />
      <Decks />
      <Forros />
      <Philosophy />
      <Inspiracao />
      <About />
      <Testimonial />
      <Blog />
      <Contact onOpenForm={() => setFormOpen(true)} />
      <Footer />
      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

export default Home;