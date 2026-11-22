import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScanLine, Users, QrCode } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayPool — Split bills over UPI in seconds" },
      { name: "description", content: "Scan any Indian receipt, split it equally or by item with GST, and collect shares via UPI links and QR codes." },
      { property: "og:title", content: "PayPool — Split bills over UPI" },
      { property: "og:description", content: "Scan receipts, split with GST, collect via UPI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (user) nav({ to: "/dashboard" });
  }, [user, nav]);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
      <Logo />
      <div className="mt-10 rounded-3xl bg-hero p-7 text-primary-foreground shadow-card">
        <h1 className="text-4xl font-bold leading-tight">Snap the bill. Split it. Get paid on UPI.</h1>
        <p className="mt-3 opacity-85">AI reads your receipt, PayPool does the GST maths, friends pay with one tap.</p>
      </div>
      <ul className="mt-6 space-y-3">
        {[
          [ScanLine, "AI receipt scan", "Restaurant bills & kirana slips"],
          [Users, "Equal or itemized", "CGST, SGST & service charge shared fairly"],
          [QrCode, "UPI links & QR", "Pay via any UPI app, track who's settled"],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof ScanLine;
          return (
            <li key={t as string} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
              <I className="h-5 w-5 text-primary" />
              <div><div className="font-semibold">{t as string}</div><div className="text-sm text-muted-foreground">{d as string}</div></div>
            </li>
          );
        })}
      </ul>
      <Button asChild size="lg" className="mt-auto h-12 rounded-2xl text-base">
        <Link to="/auth">Get started</Link>
      </Button>
    </div>
  );
}
