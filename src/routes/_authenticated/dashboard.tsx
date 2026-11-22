import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Utensils, ShoppingBasket, Plane, Zap, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, inr } from "@/lib/split";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PayPool" },
      { name: "description", content: "Your monthly spend, category breakdown and recent bill splits." },
      { property: "og:title", content: "Dashboard — PayPool" },
      { property: "og:description", content: "Monthly spend and recent splits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const ICONS = { Food: Utensils, Groceries: ShoppingBasket, Travel: Plane, Utilities: Zap } as const;

function Dashboard() {
  const { data: bills = [] } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, participants(id, is_paid, share)").order("bill_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = bills.filter((b) => b.bill_date.startsWith(monthKey));
  const total = month.reduce((s, b) => s + Number(b.grand_total), 0);
  const byCat = CATEGORIES.map((c) => ({ c, v: month.filter((b) => b.category === c).reduce((s, b) => s + Number(b.grand_total), 0) }));
  const pending = bills.flatMap((b) => b.participants).filter((p) => !p.is_paid).reduce((s, p) => s + Number(p.share), 0);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-card">
        <div className="text-sm opacity-80">Spent in {now.toLocaleString("en-IN", { month: "long" })}</div>
        <div className="mt-1 font-display text-4xl font-bold">{inr(total)}</div>
        <div className="mt-4 inline-flex rounded-full bg-primary-foreground/15 px-3 py-1 text-sm">{inr(pending)} still to collect</div>
      </section>
      <section className="grid grid-cols-2 gap-3">
        {byCat.map(({ c, v }) => {
          const I = ICONS[c];
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <div key={c} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><I className="h-4 w-4 text-primary" />{c}</div>
              <div className="mt-1 font-display text-xl font-bold">{inr(v)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Recent splits</h2>
        {bills.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No splits yet. Tap “New split” to scan your first bill.</div>
        ) : (
          <ul className="space-y-2">
            {bills.slice(0, 15).map((b) => {
              const paid = b.participants.filter((p) => p.is_paid).length;
              return (
                <li key={b.id}>
                  <Link to="/bills/$id" params={{ id: b.id }} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{b.merchant_name}</div>
                      <div className="text-xs text-muted-foreground">{b.category} · {new Date(b.bill_date).toLocaleDateString("en-IN")} · {paid}/{b.participants.length} paid</div>
                    </div>
                    <div className="font-display font-bold">{inr(Number(b.grand_total))}</div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
