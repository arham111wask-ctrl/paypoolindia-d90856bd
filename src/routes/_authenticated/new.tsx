import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { scanReceipt } from "@/lib/scan.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, equalSplit, grandTotal, inr, itemTotal, itemizedSplit, subtotal, type Friend, type Item } from "@/lib/split";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({
    meta: [
      { title: "New split — PayPool" },
      { name: "description", content: "Scan a receipt, fix items and split the bill with friends over UPI." },
      { property: "og:title", content: "New split — PayPool" },
      { property: "og:description", content: "Scan and split a bill." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewSplit,
});

const uid = () => crypto.randomUUID();

function NewSplit() {
  const nav = useNavigate();
  const scan = useServerFn(scanReceipt);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>("Food");
  const [items, setItems] = useState<Item[]>([]);
  const [extras, setExtras] = useState({ cgst: 0, sgst: 0, service_charge: 0 });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [fName, setFName] = useState("");
  const [fUpi, setFUpi] = useState("");
  const [mode, setMode] = useState<"equal" | "itemized">("equal");
  const [payerName, setPayerName] = useState(() => (typeof window !== "undefined" && localStorage.getItem("pp_name")) || "");
  const [payerUpi, setPayerUpi] = useState(() => (typeof window !== "undefined" && localStorage.getItem("pp_upi")) || "");

  async function onFile(file: File) {
    setScanning(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setReceiptPath(path);
      const r = await scan({ data: { path, mimeType: file.type } });
      setMerchant(r.merchant_name);
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
      setItems(r.items.map((i) => ({ id: uid(), name: i.name, qty: i.qty || 1, price: i.price, assigned_to: [] })));
      setExtras({ cgst: r.cgst, sgst: r.sgst, service_charge: r.service_charge });
      toast.success("Receipt scanned — check the items below");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  const upd = (id: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const total = grandTotal(items, extras);
  const ids = friends.map((f) => f.id);
  const shares = mode === "equal" ? equalSplit(total, ids) : itemizedSplit(items, ids, extras);
  const unassigned = mode === "itemized" && items.some((i) => i.assigned_to.length === 0);

  function addFriend() {
    if (!fName.trim()) return;
    setFriends((f) => [...f, { id: uid(), name: fName.trim(), upi_id: fUpi.trim() || null }]);
    setFName(""); setFUpi("");
  }

  async function save() {
    if (!payerUpi.includes("@")) return toast.error("Add your UPI ID so friends can pay you");
    if (!friends.length) return toast.error("Add at least one friend");
    if (total <= 0) return toast.error("Add items to the bill");
    setSaving(true);
    localStorage.setItem("pp_name", payerName); localStorage.setItem("pp_upi", payerUpi);
    try {
      const { data: bill, error } = await supabase.from("bills").insert({
        merchant_name: merchant || "Untitled bill", bill_date: date, category, ...extras, grand_total: total,
        split_mode: mode, payer_name: payerName || "PayPool user", payer_upi: payerUpi, receipt_path: receiptPath, note: merchant,
      }).select().single();
      if (error) throw error;
      const { error: pe } = await supabase.from("participants").insert(friends.map((f) => ({ id: f.id, bill_id: bill.id, name: f.name, upi_id: f.upi_id, share: shares[f.id] ?? 0 })));
      if (pe) throw pe;
      if (items.length) {
        const { error: ie } = await supabase.from("bill_items").insert(items.map((i) => ({ bill_id: bill.id, name: i.name, qty: i.qty, price: i.price, assigned_to: i.assigned_to })));
        if (ie) throw ie;
      }
      nav({ to: "/bills/$id", params: { id: bill.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  const card = "rounded-3xl bg-card p-5 shadow-card";
  return (
    <div className="space-y-4">
      <label className={`${card} flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-primary/30 text-center`}>
        {scanning ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Camera className="h-8 w-8 text-primary" />}
        <div className="font-semibold">{scanning ? "Reading your receipt…" : receiptPath ? "Scan another receipt" : "Upload bill photo"}</div>
        <div className="text-sm text-muted-foreground">JPG or PNG · or add items manually below</div>
        <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={scanning} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      <section className={card}>
        <h2 className="mb-3 font-bold">Bill details</h2>
        <div className="grid grid-cols-2 gap-2">
          <Input className="col-span-2" placeholder="Merchant / note" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Items</h2>
          <Button size="sm" variant="secondary" onClick={() => setItems((x) => [...x, { id: uid(), name: "", qty: 1, price: 0, assigned_to: [] }])}><Plus className="h-4 w-4" />Add</Button>
        </div>
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.id} className="rounded-2xl bg-muted/60 p-3">
              <div className="flex gap-2">
                <Input className="flex-1 bg-card" placeholder="Item" value={i.name} onChange={(e) => upd(i.id, { name: e.target.value })} />
                <Input className="w-14 bg-card" type="number" inputMode="decimal" value={i.qty} onChange={(e) => upd(i.id, { qty: Number(e.target.value) })} aria-label="Qty" />
                <Input className="w-20 bg-card" type="number" inputMode="decimal" value={i.price} onChange={(e) => upd(i.id, { price: Number(e.target.value) })} aria-label="Price" />
                <button aria-label="Delete item" className="text-destructive" onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}><Trash2 className="h-4 w-4" /></button>
              </div>
              {mode === "itemized" && friends.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {friends.map((f) => {
                    const on = i.assigned_to.includes(f.id);
                    return (
                      <button key={f.id} onClick={() => upd(i.id, { assigned_to: on ? i.assigned_to.filter((x) => x !== f.id) : [...i.assigned_to, f.id] })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{f.name}</button>
                    );
                  })}
                  <span className="ml-auto self-center text-xs text-muted-foreground">{inr(itemTotal(i))}</span>
                </div>
              )}
            </div>
          ))}
          {!items.length && <p className="text-sm text-muted-foreground">No items yet.</p>}
        </div>
        <div className="mt-4 space-y-2 border-t pt-4 text-sm">
          <Row label="Subtotal" value={inr(subtotal(items))} />
          {(["cgst", "sgst", "service_charge"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-muted-foreground">{k === "service_charge" ? "Service charge" : k.toUpperCase()}</span>
              <Input className="h-8 w-24 text-right" type="number" inputMode="decimal" value={extras[k]} onChange={(e) => setExtras((x) => ({ ...x, [k]: Number(e.target.value) }))} />
            </div>
          ))}
          <div className="flex justify-between pt-1 font-display text-lg font-bold"><span>Grand total</span><span>{inr(total)}</span></div>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">Friends</h2>
        <div className="flex gap-2">
          <Input placeholder="Name" value={fName} onChange={(e) => setFName(e.target.value)} />
          <Input placeholder="UPI (optional)" value={fUpi} onChange={(e) => setFUpi(e.target.value)} />
          <Button size="icon" onClick={addFriend} aria-label="Add friend"><UserPlus className="h-4 w-4" /></Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {friends.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
              {f.name}
              <button aria-label={`Remove ${f.name}`} onClick={() => setFriends((x) => x.filter((y) => y.id !== f.id))}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      </section>

      <section className={card}>
        <div className="mb-4 grid grid-cols-2 rounded-full bg-muted p-1 text-sm font-semibold">
          {(["equal", "itemized"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full py-2 capitalize ${mode === m ? "bg-card shadow-card" : "text-muted-foreground"}`}>{m} split</button>
          ))}
        </div>
        {unassigned && <p className="mb-3 rounded-xl bg-accent/20 p-2 text-xs">Tap friend names under each item to assign it. Unassigned items aren't counted.</p>}
        <div className="space-y-1.5">
          {friends.map((f) => <Row key={f.id} label={f.name} value={inr(shares[f.id] ?? 0)} />)}
          {!friends.length && <p className="text-sm text-muted-foreground">Add friends to see shares.</p>}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-bold">Pay to (you)</h2>
        <p className="mb-3 text-xs text-muted-foreground">Friends' UPI payments will go to this ID.</p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Your name" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
          <Input placeholder="you@okhdfcbank" value={payerUpi} onChange={(e) => setPayerUpi(e.target.value)} />
        </div>
      </section>

      <Button size="lg" className="h-12 w-full rounded-2xl text-base" disabled={saving} onClick={save}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & create UPI requests"}
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
