import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { IndianRupee, ReceiptIndianRupee } from "lucide-react";
import { Shell } from "@/components/dash/Shell";
import { Kpi, Panel, Pill } from "@/components/dash/bits";

export const Route = createFileRoute("/institute-billing")({
  head: () => ({
    meta: [
      { title: "Institute Billing — TalentBro" },
      {
        name: "description",
        content: "Pay-as-you-go billing for your TalentBro institution account.",
      },
      { property: "og:title", content: "Institute Billing — TalentBro" },
      {
        property: "og:description",
        content: "Pay as you go — settle only what your college has used.",
      },
    ],
  }),
  component: InstituteBillingPage,
});

const ADVANCE_PAID = 10_000;
const MIN_BILL = 15_000;
const MAX_BILL = 60_000;

// The billed amount is a placeholder until a real subscription endpoint exists,
// so it is drawn once per visit from a fixed range and stays put while you read
// the page — a figure that changes on every render would be a bug report.
function drawBill() {
  const step = 500;
  const raw = MIN_BILL + Math.floor(Math.random() * ((MAX_BILL - MIN_BILL) / step + 1)) * step;
  return raw;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function InstituteBillingPage() {
  const [billed] = useState(drawBill);
  const due = billed - ADVANCE_PAID;

  return (
    <Shell
      title="Institute Billing"
      subtitle="Pay as you go — settle only what your college has used"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            label="Billed this cycle"
            value={inr.format(billed)}
            icon={ReceiptIndianRupee}
            hint="Usage for the current billing period"
          />
          <Kpi
            label="Advance adjusted"
            value={`− ${inr.format(ADVANCE_PAID)}`}
            icon={IndianRupee}
            hint="Credit already paid in advance"
          />
          <Kpi
            label="Payable now"
            value={inr.format(due)}
            icon={IndianRupee}
            hint="Amount due for this cycle"
          />
        </div>

        <Panel
          title="Pay as you go"
          description="No lock-in. Every cycle bills only the seats and drives your college used."
          action={<Pill tone="solid">Pay as you go</Pill>}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="dash-mono-label text-muted-foreground">Amount payable</p>
                <p className="dash-stat-num mt-1 text-4xl sm:text-5xl">{inr.format(due)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Payable after adjusting the advance of − {inr.format(ADVANCE_PAID)}/-
                </p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Pay {inr.format(due)}
              </button>
            </div>

            <div className="rounded-md border border-border bg-muted/40">
              <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
                <span className="text-sm">Usage this cycle</span>
                <span className="dash-stat-num text-sm">{inr.format(billed)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">Less advance adjusted</span>
                <span className="dash-stat-num text-sm text-muted-foreground">
                  − {inr.format(ADVANCE_PAID)}/-
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">Payable now</span>
                <span className="dash-stat-num text-sm font-semibold">{inr.format(due)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Figures shown here are a placeholder until the billing service is connected.
            </p>
          </div>
        </Panel>
      </div>
    </Shell>
  );
}
