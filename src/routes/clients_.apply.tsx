import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Copy, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { ClientsFooter, ClientsHeader, WhatsAppIcon } from "@/components/clients/public";
import { CLIENT_CONTACT } from "@/lib/client-contact";

export const Route = createFileRoute("/clients_/apply")({
  head: () => ({
    meta: [
      { title: "Client application | TalentBro Institutions" },
      {
        name: "description",
        content:
          "Apply to bring TalentBro to your institution. Send a short email from your institutional email ID or message us on WhatsApp.",
      },
      { property: "og:title", content: "Client application | TalentBro Institutions" },
      {
        property: "og:description",
        content:
          "Institution-only application and walkthrough request for the TalentBro placement platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientApplyPage,
});

const emailSubject = "Client application — [Institution name]";

const emailBody = `Hello TalentBro team,

I'm interested in bringing TalentBro to our institution. Could we schedule a walkthrough to discuss how it can support our placement cell?

Regards,
[Your name]
[Institution name]`;

const emailDraft = `Subject: ${emailSubject}\n\n${emailBody}`;

const whatsappDraft =
  "Hi TalentBro team, I'm interested in bringing TalentBro to our institution. Could we schedule a walkthrough to discuss how it can support our placement cell?";

type CopyTarget = "subject" | "email" | "whatsapp";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!copied) throw new Error("Copy failed");
  }
}

function CopyButton({
  target,
  value,
  label,
  copied,
  onCopy,
}: {
  target: CopyTarget;
  value: string;
  label: string;
  copied: CopyTarget | null;
  onCopy: (target: CopyTarget, value: string) => void;
}) {
  const isCopied = copied === target;

  return (
    <button
      type="button"
      onClick={() => onCopy(target, value)}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink transition-colors hover:text-ink/70"
    >
      {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {isCopied ? "Copied" : label}
    </button>
  );
}

function ClientApplyPage() {
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const handleCopy = async (target: CopyTarget, value: string) => {
    try {
      await copyText(value);
      setCopied(target);
      window.setTimeout(() => {
        setCopied((current) => (current === target ? null : current));
      }, 1800);
    } catch {
      setCopied(null);
    }
  };

  const emailHref = `mailto:${CLIENT_CONTACT.email}?subject=${encodeURIComponent(
    emailSubject,
  )}&body=${encodeURIComponent(emailBody)}`;

  const whatsappHref = `https://wa.me/${CLIENT_CONTACT.whatsappNumber}?text=${encodeURIComponent(
    whatsappDraft,
  )}`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <ClientsHeader />

      <section className="border-b border-border bg-paper px-5 py-12 md:px-8 lg:py-16">
        <div className="mx-auto w-full max-w-[1200px]">
          <Link
            to="/clients"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Back to client overview
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Client application</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">
                Apply as a client.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Send us a short note from your institutional email ID or message us on WhatsApp.
                Copy a draft below, add your campus details, and we will get back with a
                walkthrough.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-background px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground lg:self-auto">
              <ShieldCheck className="size-3.5 text-ink" /> For institutions only
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8 lg:py-16">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <article className="flex flex-col rounded-lg border border-border bg-background">
              <div className="flex items-start gap-3 border-b border-border bg-paper p-5 md:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-paper">
                  <Mail className="size-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">Apply by email</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Send the draft from your institutional email ID so we can verify your campus.
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
                <div className="rounded-md border border-border bg-paper">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Subject
                    </span>
                    <CopyButton
                      target="subject"
                      value={emailSubject}
                      label="Copy"
                      copied={copied}
                      onCopy={handleCopy}
                    />
                  </div>
                  <p className="px-3.5 py-3 text-sm font-medium text-ink">{emailSubject}</p>
                </div>

                <div className="flex flex-1 flex-col rounded-md border border-border">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Email draft
                    </span>
                    <CopyButton
                      target="email"
                      value={emailDraft}
                      label="Copy email"
                      copied={copied}
                      onCopy={handleCopy}
                    />
                  </div>
                  <pre className="flex-1 overflow-auto whitespace-pre-wrap px-3.5 py-3 font-sans text-xs leading-relaxed text-muted-foreground">
                    {emailBody}
                  </pre>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
                  <a href={emailHref} className="cta-ink">
                    Open email app <ArrowRight className="size-4" />
                  </a>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    To {CLIENT_CONTACT.email}
                  </p>
                </div>
              </div>
            </article>

            <article className="flex flex-col rounded-lg border border-border bg-background">
              <div className="flex items-start gap-3 border-b border-border bg-paper p-5 md:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-paper">
                  <WhatsAppIcon className="size-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">Apply on WhatsApp</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Prefer chat? Send the short message below and we will reply with next steps.
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
                <div className="flex flex-1 flex-col rounded-md border border-border">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      WhatsApp message
                    </span>
                    <CopyButton
                      target="whatsapp"
                      value={whatsappDraft}
                      label="Copy message"
                      copied={copied}
                      onCopy={handleCopy}
                    />
                  </div>
                  <p className="flex-1 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                    {whatsappDraft}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="cta-ink">
                    Open WhatsApp <ArrowRight className="size-4" />
                  </a>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {CLIENT_CONTACT.phone}
                  </p>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-paper px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Send from your institutional email ID or message us on WhatsApp.</p>
            <p className="font-semibold text-ink">Mon–Sat, 10:00–18:00 IST</p>
          </div>
        </div>
      </section>

      <ClientsFooter />
    </main>
  );
}
