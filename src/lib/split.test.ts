import { describe, it, expect } from "vitest";
import { equalSplit, itemizedSplit, upiLink } from "./split";

describe("split rules", () => {
  it("equal split divides grand total and sums exactly", () => {
    const s = equalSplit(100, ["a", "b", "c"]);
    expect(s).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
  });
  it("itemized split spreads GST and service charge by item subtotal", () => {
    const s = itemizedSplit(
      [
        { id: "1", name: "Biryani", qty: 1, price: 300, assigned_to: ["a"] },
        { id: "2", name: "Naan", qty: 2, price: 50, assigned_to: ["a", "b"] },
      ],
      ["a", "b"],
      { cgst: 10, sgst: 10, service_charge: 20 },
    );
    // a: 350 subtotal, b: 50 → extras 40 split 35/5
    expect(s).toEqual({ a: 385, b: 55 });
  });
  it("builds NPCI UPI link with 2-decimal amount", () => {
    expect(upiLink({ payeeUpi: "me@okhdfc", payeeName: "Arham", amount: 55, note: "Dinner" })).toBe(
      "upi://pay?pa=me%40okhdfc&pn=Arham&am=55.00&cu=INR&tn=PayPool_Dinner",
    );
  });
});
