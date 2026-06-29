import { createFileRoute } from "@tanstack/react-router";
import { formatINR } from "@/lib/pos-data";

export const Route = createFileRoute("/_pos/cash")({
  head: () => ({ meta: [{ title: "Cash Counter — CHHOTA BAZAAR POS" }] }),
  component: CashPage,
});

function CashPage() {
  const opening = 5000;
  const sales = 48240;
  const expenses = 1280;
  const withdrawals = 10000;
  const expected = opening + sales - expenses - withdrawals;
  const actual = 41960;
  const variance = actual - expected;

  const rows: Array<{ label: string; value: number; color?: string; bold?: boolean }> = [
    { label: "Opening Cash", value: opening },
    { label: "Cash Sales (today)", value: sales, color: "var(--brand-green)" },
    { label: "Expenses", value: -expenses, color: "var(--brand-red)" },
    { label: "Cash Withdrawals", value: -withdrawals, color: "var(--brand-red)" },
    { label: "Expected Balance", value: expected, bold: true, color: "var(--brand-blue)" },
  ];

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Cash Counter Management</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Anjali Mehta · Shift A · Counter ST-018-A
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border-2 bg-card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Movement
          </h2>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.label}
                className={
                  "flex items-baseline justify-between rounded-xl p-3 " +
                  (r.bold ? "bg-[var(--brand-blue)] text-white" : "bg-[var(--secondary)]")
                }
              >
                <span className={"font-bold " + (r.bold ? "" : "text-muted-foreground")}>
                  {r.label}
                </span>
                <span
                  className="text-xl font-extrabold tabular-nums"
                  style={!r.bold ? { color: r.color } : undefined}
                >
                  {r.value < 0 ? "– " : ""}
                  {formatINR(Math.abs(r.value))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border-2 bg-card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Reconciliation
          </h2>
          <div className="rounded-xl bg-[var(--secondary)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Expected
            </div>
            <div className="text-3xl font-extrabold tabular-nums">{formatINR(expected)}</div>
          </div>
          <div className="mt-3 rounded-xl bg-[var(--brand-orange)]/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-orange)]">
              Actual (Counted)
            </div>
            <div className="text-3xl font-extrabold tabular-nums">{formatINR(actual)}</div>
          </div>
          <div
            className="mt-3 rounded-xl p-4 text-white"
            style={{ backgroundColor: variance === 0 ? "var(--brand-green)" : "var(--brand-red)" }}
          >
            <div className="text-xs font-bold uppercase tracking-wide text-white/80">Variance</div>
            <div className="text-3xl font-extrabold tabular-nums">
              {variance > 0 ? "+" : ""}
              {formatINR(variance)}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="tap-target-lg rounded-2xl bg-[var(--secondary)] font-extrabold active:scale-[0.98]">
              Record Expense
            </button>
            <button className="tap-target-lg rounded-2xl bg-[var(--brand-blue)] font-extrabold text-white active:scale-[0.98]">
              Close Counter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
