import assert from "node:assert/strict";
import test from "node:test";
import { handoffRequestSchema, publishOrderHandoff, type ExportStorage } from "../src/order_handoff.js";

function storageSpy() {
  const uploads: Array<{ csv: string; idempotencyKey: string }> = [];
  const storage: ExportStorage = {
    async ensureBucket() {},
    async uploadCsv(_bucket, _key, csv, idempotencyKey) {
      uploads.push({ csv, idempotencyKey });
    },
    async downloadUrl() {
      return "https://downloads.example/signed-order.csv";
    },
  };
  return { storage, uploads };
}

const baseOrder = {
  orderId: "ord_2048",
  sellerAssets: [
    { sku: "ICON-PACK", title: "UI, Icons", assetUrl: "https://seller.example/icons.zip" },
  ],
  buyerUpdates: { email: "buyer@example.com", deliveryNote: "Use \"team\" license" },
};

test("publishes one escaped CSV and download link for a fulfilled order", async () => {
  const { storage, uploads } = storageSpy();
  const input = handoffRequestSchema.parse({ ...baseOrder, status: "fulfilled" });
  const result = await publishOrderHandoff(input, storage);

  assert.equal(result.published, true);
  assert.equal(result.downloadUrl, "https://downloads.example/signed-order.csv");
  assert.match(uploads[0].csv, /"UI, Icons"/);
  assert.match(uploads[0].csv, /"Use ""team"" license"/);
  assert.equal(uploads[0].idempotencyKey.length, 64);
});

test("keeps a paid order unpublished", async () => {
  const { storage, uploads } = storageSpy();
  const input = handoffRequestSchema.parse({ ...baseOrder, status: "paid" });
  const result = await publishOrderHandoff(input, storage);

  assert.deepEqual(result, { published: false, reason: "order_not_fulfilled" });
  assert.equal(uploads.length, 0);
});
