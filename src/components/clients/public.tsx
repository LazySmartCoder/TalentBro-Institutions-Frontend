import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, Phone } from "lucide-react";

import { CLIENT_CONTACT } from "@/lib/client-contact";

const publicLinks = [
  { label: "Client overview", href: "/clients" },
  { label: "Apply as a client", href: "/clients/apply" },
  { label: "Pricing", href: "/pricing" },
  { label: "Terms & conditions", href: "/tac" },
];

export function WhatsAppIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className={`group flex items-center gap-2.5 ${dark ? "text-paper" : "text-ink"}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full ${dark ? "bg-paper" : "bg-primary"}`}
      >
        <img
          src="/favicon.ico"
          alt=""
          width={26}
          height={26}
          className="size-6.5 rounded-full object-cover"
        />
      </span>
      <span className="text-sm font-bold">
        TalentBro{" "}
        <span className={dark ? "font-medium text-paper/45" : "font-medium text-muted-foreground"}>
          Institutions
        </span>
      </span>
    </Link>
  );
}

export function ClientsHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between gap-4 px-5 md:px-10 lg:px-14">
        <BrandMark />

        <nav className="hidden items-center gap-9 text-[13px] font-semibold md:flex">
          <Link to="/clients" className="nav-link">
            Institutions
          </Link>
          <a href="/#services" className="nav-link">
            Services
          </a>
          <a href="/#students" className="nav-link">
            Students
          </a>
          <Link to="/pricing" className="nav-link">
            Pricing
          </Link>
        </nav>

        <Link to="/get-started" className="cta-ink">
          Let&apos;s Begin
        </Link>
      </div>
    </header>
  );
}

export function ContactChannels({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const card = dark
    ? "border-paper/15 bg-paper/[0.04] hover:bg-paper/[0.08]"
    : "border-border bg-background hover:bg-muted";
  const iconBox = dark
    ? "border-paper/15 bg-paper/[0.04] text-paper"
    : "border-border bg-paper text-ink";
  const label = dark ? "text-paper/45" : "text-muted-foreground";
  const value = dark ? "text-paper" : "text-ink";

  return (
    <div className="grid gap-3">
      <a
        href={`mailto:${CLIENT_CONTACT.email}`}
        className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${card}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-md border ${iconBox}`}>
          <Mail className="size-4" />
        </span>
        <span className="min-w-0">
          <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] ${label}`}>
            Email
          </span>
          <strong className={`mt-0.5 block text-sm font-semibold ${value}`}>
            {CLIENT_CONTACT.email}
          </strong>
        </span>
        <ArrowUpRight className={`ml-auto size-4 shrink-0 ${label}`} />
      </a>

      <a
        href={CLIENT_CONTACT.phoneHref}
        className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${card}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-md border ${iconBox}`}>
          <Phone className="size-4" />
        </span>
        <span className="min-w-0">
          <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] ${label}`}>
            Phone
          </span>
          <strong className={`mt-0.5 block text-sm font-semibold ${value}`}>
            {CLIENT_CONTACT.phone}
          </strong>
        </span>
        <ArrowUpRight className={`ml-auto size-4 shrink-0 ${label}`} />
      </a>

      <a
        href={CLIENT_CONTACT.whatsapp}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${card}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-md border ${iconBox}`}>
          <WhatsAppIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] ${label}`}>
            WhatsApp
          </span>
          <strong className={`mt-0.5 block text-sm font-semibold ${value}`}>
            {CLIENT_CONTACT.phone}
          </strong>
        </span>
        <ArrowUpRight className={`ml-auto size-4 shrink-0 ${label}`} />
      </a>
    </div>
  );
}

export function ClientsFooter() {
  return (
    <footer className="bg-ink px-5 py-12 text-paper md:px-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandMark dark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/50">
              Placement intelligence for institutions. One connected view of student readiness,
              drives and outcomes.
            </p>
            <a
              href={CLIENT_CONTACT.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="cta-light mt-5"
            >
              <WhatsAppIcon className="size-4" /> Chat on WhatsApp
            </a>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/40">Pages</p>
            <ul className="mt-3 space-y-2 text-sm">
              {publicLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-paper/65 transition-colors hover:text-paper">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/40">
              Contact
            </p>
            <ul className="mt-3 space-y-3 text-sm">
              <li>
                <a
                  href={`mailto:${CLIENT_CONTACT.email}`}
                  className="flex items-center gap-2 text-paper/65 hover:text-paper"
                >
                  <Mail className="size-4" /> {CLIENT_CONTACT.email}
                </a>
              </li>
              <li>
                <a
                  href={CLIENT_CONTACT.phoneHref}
                  className="flex items-center gap-2 text-paper/65 hover:text-paper"
                >
                  <Phone className="size-4" /> {CLIENT_CONTACT.phone}
                </a>
              </li>
              <li>
                <a
                  href={CLIENT_CONTACT.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-paper/65 hover:text-paper"
                >
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
              </li>
            </ul>
            <p className="mt-4 text-xs text-paper/35">Mon–Sat, 10:00–18:00 IST</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-paper/10 pt-6 text-xs text-paper/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 TalentBro. Built for better placements.</p>
          <p>Institution enquiries only · Students should use the student platform.</p>
        </div>
      </div>
    </footer>
  );
}
