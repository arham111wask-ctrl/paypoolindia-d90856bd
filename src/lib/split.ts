export type Item = { id: string; name: string; qty: number; price: number; assigned_to: string[] };
export type Friend = { id: string; name: string; upi_id?: string | null };
export type Extras = { cgst: number; sgst: number; service_charge: number };

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const itemTotal = (i: Item) => (Number(i.qty) || 0) * (Number(i.price) || 0);
export const subtotal = (items: Item[]) => items.reduce((s, i) => s + itemTotal(i), 0);
export const grandTotal = (items: Item[], e: Extras) =>
  r2(subtotal(items) + (Number(e.cgst) || 0) + (Number(e.sgst) || 0) + (Number(e.service_charge) || 0));

/** Rounds shares to paise and puts any leftover paise on the first person so shares sum to total. */
function balance(raw: Record<string, number>, total: number) {
  const ids = Object.keys(raw);
  const out: Record<string, number> = {};
  ids.forEach((id) => (out[id] = r2(raw[id] ?? 0)));
  const diff = r2(total - ids.reduce((s, id) => s + (out[id] ?? 0), 0));
  if (ids[0] && diff !== 0) out[ids[0]] = r2((out[ids[0]] ?? 0) + diff);
  return out;
}

export function equalSplit(total: number, friendIds: string[]) {
  if (!friendIds.length) return {};
  const raw: Record<string, number> = {};
  friendIds.forEach((id) => (raw[id] = total / friendIds.length));
  return balance(raw, r2(total));
}

/** Each item is split among its assignees; taxes & service charge follow each person's item subtotal. */
export function itemizedSplit(items: Item[], friendIds: string[], e: Extras) {
  const sub: Record<string, number> = {};
  friendIds.forEach((id) => (sub[id] = 0));
  let assignedSub = 0;
  for (const it of items) {
    const who = it.assigned_to.filter((id) => id in sub);
    if (!who.length) continue;
    const each = itemTotal(it) / who.length;
    who.forEach((id) => (sub[id] = (sub[id] ?? 0) + each));
    assignedSub += itemTotal(it);
  }
  const extras = (Number(e.cgst) || 0) + (Number(e.sgst) || 0) + (Number(e.service_charge) || 0);
  const raw: Record<string, number> = {};
  friendIds.forEach((id) => {
    const s = sub[id] ?? 0;
    raw[id] = s + (assignedSub > 0 ? (extras * s) / assignedSub : 0);
  });
  return balance(raw, r2(assignedSub + (assignedSub > 0 ? extras : 0)));
}

export function upiLink(o: { payeeUpi: string; payeeName: string; amount: number; note: string }) {
  const tn = `PayPool_${o.note.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40)}`;
  return `upi://pay?pa=${encodeURIComponent(o.payeeUpi)}&pn=${encodeURIComponent(o.payeeName)}&am=${o.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(tn)}`;
}

export const inr = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const CATEGORIES = ["Food", "Groceries", "Travel", "Utilities"] as const;
