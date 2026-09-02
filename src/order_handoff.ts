import { createHash } from "node:crypto";
import { z } from "zod";
import { infrai } from "./infrai_storage.js";

export const handoffRequestSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["paid", "fulfilled", "refunded"]),
  sellerAssets: z.array(
    z.object({
      sku: z.string().min(1),
      title: z.string().min(1),
      assetUrl: z.string().url(),
    }),
  ).min(1),
  buyerUpdates: z.object({
    email: z.string().email(),
    deliveryNote: z.string().max(500),
  }),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export type ExportStorage = {
  ensureBucket(name: string): Promise<void>;
  uploadCsv(bucket: string, key: string, csv: string, idempotencyKey: string): Promise<void>;
  downloadUrl(bucket: string, key: string): Promise<string>;
};

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function renderOrderCsv(input: HandoffRequest): string {
  const header = ["order_id", "buyer_email", "delivery_note", "sku", "title", "asset_url"];
  const rows = input.sellerAssets.map((asset) => [
    input.orderId,
    input.buyerUpdates.email,
    input.buyerUpdates.deliveryNote,
    asset.sku,
    asset.title,
    asset.assetUrl,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export async function publishOrderHandoff(input: HandoffRequest, storage: ExportStorage) {
  if (input.status !== "fulfilled") {
    return { published: false as const, reason: "order_not_fulfilled" as const };
  }

  const bucket = "marketplace-order-exports";
  const key = `orders/${input.orderId}/handoff.csv`;
  const csv = renderOrderCsv(input);
  const idempotencyKey = createHash("sha256").update(`${key}\n${csv}`).digest("hex");
  await storage.ensureBucket(bucket);
  await storage.uploadCsv(bucket, key, csv, idempotencyKey);
  const downloadUrl = await storage.downloadUrl(bucket, key);
  return { published: true as const, orderId: input.orderId, key, downloadUrl };
}

export const infraiExportStorage: ExportStorage = {
  async ensureBucket(name) {
    await infrai.storage.bucket.create({ name });
  },
  async uploadCsv(bucket, key, csv, idempotencyKey) {
    const signed = await infrai.storage.object.presign(bucket, key, {
      op: "put",
      expires_seconds: 300,
      content_type: "text/csv; charset=utf-8",
      max_bytes: Buffer.byteLength(csv),
      idempotency_key: idempotencyKey,
    });
    const response = await fetch(signed.url, {
      method: "PUT",
      headers: { "Content-Type": "text/csv; charset=utf-8" },
      body: csv,
    });
    if (!response.ok) throw new Error(`CSV upload was rejected (${response.status}).`);
  },
  async downloadUrl(bucket, key) {
    const signed = await infrai.storage.object.presign(bucket, key, {
      op: "get",
      expires_seconds: 900,
      response_disposition: 'attachment; filename="order-handoff.csv"',
    });
    return signed.url;
  },
};
