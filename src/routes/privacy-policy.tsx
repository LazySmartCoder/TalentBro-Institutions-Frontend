import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | TalentBro Institutions" },
      {
        name: "description",
        content: "Privacy Policy explaining how TalentBro Institutions collects, uses, and protects your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <h2 className="flex items-baseline gap-3 text-xl font-semibold text-foreground">
        <span className="text-sm font-bold text-muted-foreground/60">{number}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="bg-ink px-5 py-16 text-paper md:px-10 lg:px-14 lg:py-24">
        <div className="mx-auto max-w-[880px]">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-paper/50 transition-colors hover:text-paper"
          >
            <ArrowLeft className="size-4" /> Back to Home
          </Link>
          <p className="eyebrow eyebrow-dark mt-12">Privacy</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">Privacy Policy</h1>
          <p className="mt-5 text-sm text-paper/55">Last updated: 24 September 2026</p>
        </div>
      </header>

      <section className="mx-auto max-w-[880px] px-5 pb-20 md:px-10 lg:px-14">
        <div className="py-10 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            This Privacy Policy explains how TalentBro ("we", "us", "our") collects, uses, shares, and
            protects personal information in connection with the TalentBro Institutions platform and
            related services (the "Service"). By using the Service, you consent to the practices described
            in this policy.
          </p>
        </div>

        <Section number="01" title="Information We Collect">
          <p>
            We collect information you provide directly, including account details (name, email,
            institution, role), academic information (programme, batch, CGPA, attendance, backlogs, skill
            records), and content you create while using the Service such as training recordings,
            transcripts, answers, and assessment results.
          </p>
          <p>
            We also collect information automatically, including device and browser information, IP
            address, usage data, session lengths, and diagnostics used to operate and improve the Service.
          </p>
        </Section>

        <Section number="02" title="How We Use Information">
          <p>
            We use the information we collect to provide, operate, and maintain the Service; to personalise
            training, feedback, and readiness scoring; to generate talent intelligence for placement cells;
            to process and respond to requests; to communicate with you; to improve the Service; and to
            protect the security and integrity of the platform.
          </p>
        </Section>

        <Section number="03" title="Audio &amp; Video Processing">
          <p>
            Certain features (for example, mock interviews and group discussions) capture audio and video
            so that AI feedback can be generated. These captures are processed to produce transcripts,
            analyses, and scores, and are stored securely for a limited period. Institutional
            administrators may be able to view these records as part of placement intelligence.
          </p>
        </Section>

        <Section number="04" title="Sharing &amp; Disclosure">
          <p>
            We do not sell your personal information. We share information with authorised users within
            your institution as needed to deliver the Service, and with service providers who process data
            on our behalf under appropriate confidentiality obligations. We may disclose information where
            required by law, or where necessary to protect the rights, safety, or security of TalentBro, our
            users, or the public.
          </p>
        </Section>

        <Section number="05" title="Student Data &amp; Institutional Control">
          <p>
            Where an institution subscribes to the Service, the institution acts as the controller for
            student data obtained through its programmes. We process such data on behalf of the institution
            and follow reasonable instructions from the institution regarding access, correction, and
            deletion of student data.
          </p>
        </Section>

        <Section number="06" title="Data Retention">
          <p>
            We retain personal information only for as long as necessary to provide the Service, comply
            with legal obligations, resolve disputes, and enforce agreements. When data is no longer
            needed, we delete or de-identify it in line with applicable law.
          </p>
        </Section>

        <Section number="07" title="Cookies &amp; Local Storage">
          <p>
            The Service uses cookies and browser local storage to keep you signed in, remember preferences,
            and understand how the Service is used. You can control cookies through your browser settings;
            however, disabling them may affect some functionality.
          </p>
        </Section>

        <Section number="08" title="Security">
          <p>
            We implement appropriate technical and organisational measures to protect personal information
            against unauthorised access, alteration, disclosure, or destruction. No method of transmission
            or storage is completely secure, and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section number="09" title="Your Rights">
          <p>
            Depending on your jurisdiction, you may have the right to access, correct, delete, or export
            your personal information, and to object to or restrict certain processing. To exercise these
            rights, contact your institution or email us at the address below. We will respond in
            accordance with applicable law.
          </p>
        </Section>

        <Section number="10" title="Children's Privacy">
          <p>
            The Service is intended for use by higher-education institutions, placement cells, and enrolled
            students. We do not knowingly collect personal information from children other than in the
            context of institution-managed placements. If you believe a child has provided us with
            personal information beyond this context, please contact us and we will take steps to delete it.
          </p>
        </Section>

        <Section number="11" title="International Transfers">
          <p>
            Personal information may be stored or processed outside your country of residence by us or our
            service providers. Where transfers occur, we take reasonable steps to protect the information
            in line with this policy and applicable law.
          </p>
        </Section>

        <Section number="12" title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated by
            updating this page and, where appropriate, notifying account administrators. Your continued use
            of the Service after changes take effect constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section number="13" title="Contact">
          <p>
            If you have questions about this Privacy Policy or your data, contact us at{" "}
            <a href="mailto:institutions@talentbro.com" className="text-foreground underline underline-offset-4">
              institutions@talentbro.com
            </a>
            .
          </p>
        </Section>
      </section>

      <footer className="bg-ink px-5 pb-8 pt-10 text-paper md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[880px] flex-col items-center justify-between gap-5 border-t border-paper/10 pt-8 sm:flex-row">
          <Link to="/" className="text-sm font-bold">
            TalentBro <span className="font-medium text-muted-foreground">Institutions</span>
          </Link>
          <p className="text-xs text-paper/35">© 2026 TalentBro. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}