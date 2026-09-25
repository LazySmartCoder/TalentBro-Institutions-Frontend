import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/tac")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions | TalentBro Institutions" },
      {
        name: "description",
        content: "Terms and Conditions governing the use of the TalentBro Institutions platform.",
      },
    ],
  }),
  component: TermsPage,
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

function TermsPage() {
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
          <p className="eyebrow eyebrow-dark mt-12">Legal</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">Terms &amp; Conditions</h1>
          <p className="mt-5 text-sm text-paper/55">Last updated: 24 September 2026</p>
        </div>
      </header>

      <section className="mx-auto max-w-[880px] px-5 pb-20 md:px-10 lg:px-14">
        <div className="py-10 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            These Terms &amp; Conditions ("Terms") govern your access to and use of the TalentBro Institutions
            platform and related services (collectively, the "Service"), operated by TalentBro ("we", "us",
            "our"). By creating an account or using the Service, you agree to be bound by these Terms. If you
            are agreeing on behalf of an institution, you confirm that you have authority to bind that
            institution.
          </p>
        </div>

        <Section number="01" title="Acceptance of Terms">
          <p>
            By accessing or using the Service, you accept and agree to these Terms and our Privacy Policy.
            If you do not agree, you may not use the Service. We may update these Terms from time to time;
            continued use of the Service after changes take effect constitutes acceptance of the revised
            Terms.
          </p>
        </Section>

        <Section number="02" title="Description of the Service">
          <p>
            The Service provides AI-assisted placement preparation for students and talent intelligence
            tools for institutional placement cells, including mock interviews, group discussions,
            aptitude and technical training, skill mapping, eligibility matching, drive management, and
            placement analytics.
          </p>
        </Section>

        <Section number="03" title="Institutional Accounts">
          <p>
            Authorised representatives of an institution may create and administer an institutional
            account. Institutions are responsible for maintaining the confidentiality of account
            credentials, for all activity that occurs under their account, and for ensuring that students
            participating in the Service have been informed of how their data will be used.
          </p>
        </Section>

        <Section number="04" title="Student Accounts">
          <p>
            Students must provide accurate and current information when registering. Students are
            responsible for safeguarding their credentials and for all activity under their account.
            Unauthorised use of another person's account is prohibited.
          </p>
        </Section>

        <Section number="05" title="Acceptable Use">
          <p>
            You agree not to misuse the Service, including by attempting to gain unauthorised access to
            the Service or related systems, interfering with the operation of the Service, scraping or
            harvesting data, or using the Service for any unlawful purpose. Sharing or reselling access to
            the Service without our written consent is prohibited.
          </p>
        </Section>

        <Section number="06" title="Intellectual Property">
          <p>
            The Service, including its software, content, training materials, design, and technology, is
            owned by or licensed to TalentBro and is protected by intellectual property laws. You may not
            copy, modify, distribute, or create derivative works from the Service except as expressly
            permitted. Student-generated content and institution data remain the property of their
            respective owners.
          </p>
        </Section>

        <Section number="07" title="Data &amp; Privacy">
          <p>
            Your use of the Service is subject to our Privacy Policy, which describes how we collect, use,
            and protect personal data. Certain features rely on audio and video processing during training
            sessions; such processing is performed to provide the Service and is described in the Privacy
            Policy.
          </p>
        </Section>

        <Section number="08" title="Fees &amp; Payments">
          <p>
            Where the Service is provided under a paid agreement, fees are set out in the applicable
            agreement or order form. Unless otherwise agreed, fees are payable in advance and are
            non-refundable except as required by law.
          </p>
        </Section>

        <Section number="09" title="Third-Party Services">
          <p>
            The Service may rely on or integrate with third-party services (for example, audio-video
            processing or browser-based AI models). We are not responsible for the availability or
            performance of third-party services, and your use of them may be subject to separate terms.
          </p>
        </Section>

        <Section number="10" title="Disclaimer of Warranties">
          <p>
            The Service is provided on an "as is" and "as available" basis. To the maximum extent
            permitted by law, we disclaim all warranties, whether express or implied, including implied
            warranties of merchantability, fitness for a particular purpose, and non-infringement. We do
            not warrant that the Service will be uninterrupted, error-free, or that results from training
            or analytics will guarantee placement outcomes.
          </p>
        </Section>

        <Section number="11" title="Limitation of Liability">
          <p>
            To the maximum extent permitted by law, TalentBro shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or for any loss of data, revenue, or
            business opportunity, arising out of or relating to your use of the Service. Our total
            aggregate liability for any claim shall not exceed the amounts paid by you for the Service in
            the twelve months preceding the claim.
          </p>
        </Section>

        <Section number="12" title="Termination">
          <p>
            We may suspend or terminate access to the Service for violation of these Terms, unauthorised
            use, or activity that threatens the security or integrity of the Service. Upon termination,
            your right to use the Service ceases, and we may archive or delete your data in accordance
            with our Privacy Policy and applicable law.
          </p>
        </Section>

        <Section number="13" title="Governing Law">
          <p>
            These Terms are governed by the laws applicable in the jurisdiction in which TalentBro operates,
            without regard to conflict-of-law principles. Any disputes arising under these Terms shall be
            resolved in the competent courts of that jurisdiction.
          </p>
        </Section>

        <Section number="14" title="Changes to These Terms">
          <p>
            We may revise these Terms at any time by updating this page. When material changes are made,
            we will notify institutional account administrators and update the "Last updated" date above.
            Continued use of the Service after revisions constitute acceptance of the updated Terms.
          </p>
        </Section>

        <Section number="15" title="Contact">
          <p>
            If you have questions about these Terms, contact us at{" "}
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