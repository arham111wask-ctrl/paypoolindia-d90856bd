import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Check, Clock, Copy, Smartphone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { inr, upiLink } from "@/lib/split";

export const Route = createFileRoute("/_authenticated/bills/$id")({
  head: () => ({
    meta: [
      { title: "Bill split — PayPool" },
      { name: "description", content: "UPI payment links, QR codes and settlement status for this bill." },
      { property: "og:title", content: "Bill split — PayPool" },
      { property: "og:description", content: "Pay your share via UPI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillPage,
});

function BillPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: bill } = useQuery({
    queryKey: ["bill", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, participants(*), bill_items(*)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  if (!bill) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  const people = [...bill.participants].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const link = (amt: number) => upiLink({ payeeUpi: bill.payer_upi ?? "", payeeName: bill.payer_name ?? "PayPool", amount: amt, note: bill.note || bill.merchant_name });
  const paidCount = people.filter((p) => p.is_paid).length;

  async function toggle(pid: string, is_paid: boolean) {
    const { error } = await supabase.from("participants").update({ is_paid }).eq("id", pid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bill", id] });
    qc.invalidateQueries({ queryKey: ["bills"] });
  }
  async function copySummary() {
    const lines = [
      `🧾 *PayPool split — ${bill!.merchant_name}*`,
      `${new Date(bill!.bill_date).toLocaleDateString("en-IN")} · Total ${inr(Number(bill!.grand_total))}`,
      "",
      ...people.map((p) => `${p.is_paid ? "✅" : "⏳"} ${p.name}: ${inr(Number(p.share))}`),
      "",
      `Pay ${bill!.payer_name} on UPI: ${bill!.payer_upi}`,
      "— Split with PayPool",
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Summary copied — paste it in WhatsApp");
  }
  async function remove() {
    if (!confirm("Delete this split?")) return;
    await supabase.from("bills").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bills"] });
    nav({ to: "/dashboard" });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-card">
        <div className="text-sm opacity-80">{bill.category} · {new Date(bill.bill_date).toLocaleDateString("en-IN")} · {bill.split_mode} split</div>
        <h1 className="mt-1 text-2xl font-bold">{bill.merchant_name}</h1>
        <div className="mt-2 font-display text-3xl font-bold">{inr(Number(bill.grand_total))}</div>
        <div className="mt-3 text-sm opacity-85">{paidCount}/{people.length} settled · paying to {bill.payer_upi}</div>
      </section>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={copySummary}><Copy className="h-4 w-4" />Copy WhatsApp summary</Button>
        <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete split"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      {people.map((p) => {
        const amt = Number(p.share);
        const url = link(amt);
        return (
          <section key={p.id} className="rounded-3xl bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{p.name}</div>
                {p.upi_id && <div className="text-xs text-muted-foreground">{p.upi_id}</div>}
                <div className="mt-1 font-display text-2xl font-bold">{inr(amt)}</div>
              </div>
              <button onClick={() => toggle(p.id, !p.is_paid)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${p.is_paid ? "bg-success text-success-foreground" : "bg-accent/25 text-accent-foreground"}`}>
                {p.is_paid ? <><Check className="h-3.5 w-3.5" />Paid</> : <><Clock className="h-3.5 w-3.5" />Pending</>}
              </button>
            </div>
            {!p.is_paid && amt > 0 && (
              <div className="mt-4 flex items-center gap-4">
                <div className="hidden rounded-xl bg-card p-2 ring-1 ring-border sm:block"><QRCodeSVG value={url} size={112} /></div>
                <div className="flex-1 space-y-2">
                  <Button asChild className="w-full"><a href={url}><Smartphone className="h-4 w-4" />Pay via UPI App</a></Button>
                  <p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Scan the QR with any UPI app, or </span>share the summary for {p.name} to pay.</p>
                </div>
              </div>
            )}
          </section>
        );
      })}
      {bill.bill_items.length > 0 && (
        <section className="rounded-3xl bg-card p-5 text-sm shadow-card">
          <h2 className="mb-2 font-bold">Items</h2>
          {bill.bill_items.map((i) => (
            <div key={i.id} className="flex justify-between py-1"><span>{i.qty} × {i.name}</span><span>{inr(Number(i.qty) * Number(i.price))}</span></div>
          ))}
          <div className="mt-2 border-t pt-2 text-muted-foreground">CGST {inr(Number(bill.cgst))} · SGST {inr(Number(bill.sgst))} · Service {inr(Number(bill.service_charge))}</div>
        </section>
      )}
    </div>
  );
}
