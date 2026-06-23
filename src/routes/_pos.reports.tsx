import { createFileRoute } from "@tanstack/react-router";
import { formatINR } from "@/lib/pos-data";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_pos/reports")({
  head: () => ({ meta: [{ title: "Daily Sales Report — CHOTA BAZAAR POS" }] }),
  component: ReportsPage,
});

const HOURLY = [
  { h: "08", s: 4200 },
  { h: "09", s: 7800 },
  { h: "10", s: 11200 },
  { h: "11", s: 14800 },
  { h: "12", s: 18600 },
  { h: "13", s: 16200 },
  { h: "14", s: 12400 },
  { h: "15", s: 9800 },
  { h: "16", s: 13200 },
  { h: "17", s: 17400 },
  { h: "18", s: 19800 },
  { h: "19", s: 21200 },
];
const CATS = [
  { name: "Fruits & Veg", v: 38200, c: "#5FAE3E" },
  { name: "Dairy", v: 28400, c: "#052B7B" },
  { name: "Snacks", v: 22800, c: "#FFC928" },
  { name: "Beverages", v: 18200, c: "#E1261C" },
  { name: "Household", v: 15600, c: "#FF7A00" },
  { name: "Personal Care", v: 12400, c: "#052B7B" },
  { name: "Bakery", v: 9800, c: "#FF7A00" },
];
const TOP = [
  { n: "Amul Gold Milk 1L", u: 142, r: 9656 },
  { n: "Britannia Bread 400g", u: 88, r: 3696 },
  { n: "Bisleri Water 1L", u: 76, r: 1520 },
  { n: "Banana Robusta 1dz", u: 64, r: 3136 },
  { n: "Parle-G 250g", u: 58, r: 1624 },
];

function ReportsPage() {
  const kpis = [
    { l: "Total Sales", v: "₹1,42,860", c: "var(--brand-green)" },
    { l: "Orders", v: "189", c: "var(--brand-blue)" },
    { l: "Avg Basket", v: "₹756", c: "var(--brand-orange)" },
    { l: "Refunds", v: "₹2,140", c: "var(--brand-red)" },
    { l: "Cash", v: "₹48,240", c: "var(--brand-green)" },
    { l: "UPI", v: "₹62,400", c: "var(--brand-blue)" },
    { l: "Card", v: "₹24,820", c: "var(--brand-orange)" },
    { l: "Wallet", v: "₹7,400", c: "var(--brand-red)" },
  ];
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Daily Sales Report</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Today · ST-018 Karol Bagh · Updated just now
          </p>
        </div>
        <button className="tap-target rounded-xl bg-[var(--brand-blue)] px-5 font-extrabold text-white active:scale-95">
          Export
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className="rounded-2xl border-2 bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {k.l}
            </div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color: k.c }}>
              {k.v}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border-2 bg-card p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Hourly Sales
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HOURLY}>
                <XAxis
                  dataKey="h"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "2px solid var(--border)",
                    fontWeight: 700,
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Bar dataKey="s" fill="var(--brand-blue)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border-2 bg-card p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Category Performance
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CATS} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "2px solid var(--border)",
                    fontWeight: 700,
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Bar dataKey="v" radius={[0, 6, 6, 0]}>
                  {CATS.map((c, i) => (
                    <Cell key={i} fill={c.c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border-2 bg-card p-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Top Products
        </h2>
        <table className="w-full text-left">
          <thead className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Product</th>
              <th className="py-2 text-right">Units</th>
              <th className="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="font-bold">
            {TOP.map((t) => (
              <tr key={t.n} className="border-t">
                <td className="py-3">{t.n}</td>
                <td className="py-3 text-right tabular-nums">{t.u}</td>
                <td className="py-3 text-right tabular-nums">{formatINR(t.r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
