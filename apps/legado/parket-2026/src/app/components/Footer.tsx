export function Footer() {
  const socials = [
    { label: "Instagram", url: "https://www.instagram.com/parketpisos/" },
    { label: "YouTube", url: "https://www.youtube.com/@Parketoficial" },
    { label: "Pinterest", url: "https://br.pinterest.com/parketpisosrevestimentos/" },
    { label: "LinkedIn", url: "https://linkedin.com/company/parket" },
  ];

  return (
    <footer className="bg-[#0D0D0D] border-t border-[#E8E4DF]/5">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 py-5">
        <div className="flex items-center justify-center gap-8">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8C8478]/70 text-[12px] uppercase tracking-[0.1em] hover:text-[#E8E4DF] transition-colors duration-300"
              style={{ fontWeight: 500 }}
            >
              {s.label}
            </a>
          ))}
        </div>
        <p
          className="text-[#8C8478]/40 text-[11px] text-center mt-3"
          style={{ fontWeight: 400 }}
        >
          &copy; 2026 Parket. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}