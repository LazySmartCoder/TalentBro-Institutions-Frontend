import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import { Bar, Kpi, Panel, Pill, chartColors } from "@/components/dash/bits";
import { getReportsData, type ReportsData } from "@/lib/api";
import { randomMotivationQuote } from "@/lib/quotes";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — TalentBro Placement Analytics" },
      {
        name: "description",
        content:
          "Live placement analytics computed from the institution's recorded students and companies.",
      },
      { property: "og:title", content: "Reports — TalentBro" },
      {
        property: "og:description",
        content: "Live placement analytics — students, drives, eligibility and CTC bands.",
      },
    ],
  }),
  component: ReportsPage,
});

const tooltip = {
  borderRadius: 8,
  border: "1px solid oklch(0.9 0 0)",
  background: "oklch(1 0 0)",
  fontSize: 12,
} as const;

function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuote] = useState(randomMotivationQuote);

  useEffect(() => {
    let cancelled = false;
    getReportsData()
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load reports.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <span className="max-w-md text-center text-sm leading-relaxed text-muted-foreground">
          {error ?? loadingQuote}
        </span>
      </div>
    );
  }

  const k = data.kpis;
  const totalIndustry = Math.max(
    1,
    data.industries.reduce((a, i) => a + i.count, 0),
  );
  const maxTier = Math.max(1, ...data.tiers.map((t) => t.count));
  const maxBand = Math.max(1, ...data.ctc_bands.map((b) => b.companies));

  return (
    <Shell
      title="Reports"
      subtitle="Live placement analytics computed from the recorded students and companies"
      actions={
        <>
          <button
            onClick={() => toast.success("Report sent to printer queue")}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium hover:bg-accent"
          >
            <Printer className="size-3.5" /> Print
          </button>
          <button
            onClick={() => toast.success("Placement snapshot exported as PDF")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <FileText className="size-3.5" /> Generate Report
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Students Covered" value={k.students} hint={`batch of ${data.batch.year}`} />
        <Kpi
          label="Placement Rate"
          value={k.rate}
          suffix="%"
          hint={`${k.placed} placed · ${k.eligible} eligible`}
        />
        <Kpi
          label="Avg Expected CTC"
          value={k.avg_expected_ctc?.toFixed(1) ?? "—"}
          suffix="LPA"
          hint="students' stated expectations"
        />
        <Kpi label="Recruiters" value={k.recruiters} hint={`${k.openings} openings recorded`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Students Onboarded"
          description="Profiles added to the platform each month"
        >
          <ResponsiveContainer width="100%" height={252}>
            <LineChart data={data.monthly} margin={{ left: -18, right: 6, top: 6 }}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip contentStyle={tooltip} />
              <Line
                type="monotone"
                dataKey="students"
                stroke={chartColors.ink}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Company Tiers" description="Recorded recruiters by tier">
          <div className="space-y-3">
            {data.tiers.map((t) => (
              <div key={t.tier}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{t.label}</span>
                  <span className="font-mono text-muted-foreground">{t.count} companies</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={t.count} max={maxTier} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Department Summary"
        description="Placement performance by branch"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {[
                  "Department",
                  "Students",
                  "Eligible",
                  "Placed",
                  "Rate",
                  "Avg CGPA",
                  "Avg Exp CTC",
                ].map((h) => (
                  <th key={h} className="mono-label px-5 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.depts.map((d) => (
                <tr key={d.department} className="hover:bg-muted/60">
                  <td className="px-5 py-3 font-medium">{d.department}</td>
                  <td className="px-5 py-3 font-mono">{d.total}</td>
                  <td className="px-5 py-3 font-mono">{d.eligible}</td>
                  <td className="px-5 py-3 font-mono">{d.placed}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <Bar value={d.rate} />
                      </div>
                      <span className="font-mono text-xs">{d.rate}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono">{d.avg_cgpa.toFixed(2)}</td>
                  <td className="px-5 py-3 font-mono">₹{d.avg_expected_ctc} LPA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Industry Breakdown"
          description="Recruiters recorded by industry"
        >
          <div className="space-y-3.5">
            {data.industries.map((i) => (
              <div key={i.industry}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">{i.industry}</span>
                  <span className="font-mono text-muted-foreground">
                    {i.count > 1 ? `${i.count} companies` : `${i.count} company`} ·{" "}
                    {Math.round((i.count / totalIndustry) * 100)}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={i.count} max={totalIndustry} />
                </div>
              </div>
            ))}
            {data.industries.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No companies recorded yet.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="CTC Bands" description="Companies by advertised CTC">
          <div className="space-y-3">
            {data.ctc_bands.map((b) => (
              <div key={b.band}>
                <div className="flex justify-between text-xs">
                  <span>{b.band}</span>
                  <span className="font-mono text-muted-foreground">
                    {b.companies > 1 ? `${b.companies} companies` : `${b.companies} company`}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={b.companies} max={maxBand} />
                </div>
              </div>
            ))}
            {data.ctc_bands.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No salary data recorded.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Panel title="Verified Profiles" description="By the placement cell">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{data.batch.verified}</span>
            <Pill tone={data.batch.unverified > 0 ? "outline" : "solid"}>
              {data.batch.unverified} pending
            </Pill>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {Math.round((data.batch.verified / Math.max(1, data.batch.students)) * 100)}% of batch
            verified
          </p>
        </Panel>
      </div>
    </Shell>
  );
}
