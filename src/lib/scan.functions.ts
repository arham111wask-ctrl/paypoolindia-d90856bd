import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReceiptSchema = z.object({
  merchant_name: z.string(),
  date: z.string(),
  items: z.array(z.object({ name: z.string(), qty: z.number(), price: z.number() })),
  cgst: z.number(),
  sgst: z.number(),
  service_charge: z.number(),
  grand_total: z.number(),
});
export type ScannedReceipt = z.infer<typeof ReceiptSchema>;

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; mimeType: string }) => d)
  .handler(async ({ data, context }) => {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai/run-id");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    if (!data.path.startsWith(context.userId + "/")) throw new Error("Not allowed");

    const { data: file, error } = await context.supabase.storage.from("receipts").download(data.path);
    if (error || !file) throw new Error("Could not read the uploaded receipt");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const dataUrl = `data:${data.mimeType};base64,${btoa(bin)}`;

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "You read Indian restaurant bills and kirana receipts. Return ONLY a JSON object with keys merchant_name (string), date (YYYY-MM-DD, empty string if unknown), items (array of {name, qty, price} where price is the UNIT price in rupees), cgst, sgst, service_charge, grand_total (numbers in rupees, 0 if absent). No markdown.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract this receipt as JSON." },
            { type: "file", data: dataUrl, mediaType: data.mimeType },
          ],
        },
      ],
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = await result.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Couldn't read this receipt. Try a clearer photo.");
    const parsed = ReceiptSchema.safeParse(JSON.parse(match[0]));
    if (!parsed.success) throw new Error("Couldn't read this receipt. Try a clearer photo.");
    return parsed.data;
  });
