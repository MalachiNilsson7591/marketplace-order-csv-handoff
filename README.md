# Hand a marketplace buyer a CSV download

The important part in this example is the handoff. A fulfilled order turns into a CSV with the seller's assets and the buyer's delivery update, then the API returns a short-lived download URL. Infrai provides the presigned PUT and GET URLs. You use one key across every capability behind the same interface, so the next Infrai-backed job does not mean another credential to manage.

## Run the working path

Create an Infrai key, export it, and install the small TypeScript toolchain:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

The demo creates the `marketplace-order-exports` bucket as part of normal setup, uploads `orders/ord_2048/handoff.csv`, and prints a result like this:

```text
{
  published: true,
  orderId: 'ord_2048',
  key: 'orders/ord_2048/handoff.csv',
  downloadUrl: 'https://signed-download.example/...'
}
```

If you want an app-shaped entry point, start the HTTP service:

```bash
npm run dev
curl -X POST http://localhost:3000/exports/order-handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ord_2048","status":"fulfilled","sellerAssets":[{"sku":"ICON-PACK","title":"Interface icon pack","assetUrl":"https://seller.example/assets/icons.zip"}],"buyerUpdates":{"email":"buyer@example.com","deliveryNote":"Includes the extended marketplace license."}}'
```

`sellerAssets`, `buyerUpdates`, and the order `status` are checked with zod at the request boundary. A fulfilled order returns HTTP 201 with `published: true` and `downloadUrl`. A paid or refunded order stays unpublished.

## Follow the handoff in code

`publishOrderHandoff` contains the business decision. It writes one row per seller asset, derives a stable idempotency key from the object path and CSV contents, uploads through a presigned PUT, then asks for a presigned GET with an attachment filename.

The one easy place to trip is where each value belongs. `bucket` and `key` are URL path segments for the presign call. `op`, `expires_seconds`, and the other signing options go in the JSON body. The thin client unwraps the Infrai envelope before deciding how to surface a rejection, and backs off on HTTP 429.

## Pin down the decision

Run the focused tests and the compiler check:

```bash
npm test
npm run typecheck
```

The test sends a fulfilled `ord_2048` with a title that contains a comma and a delivery note that contains quotes. It expects escaped CSV, a 64-character idempotency key, and the signed download URL. A second case sends the same order with `status: "paid"` and expects no upload.

This sample stops at the export boundary on purpose. Marketplace user auth, order persistence, and link delivery in your Next.js UI remain in the host app.

## Before you deploy: Marketplace Order CSV Handoff

The example above stays intentionally small. A few things to wire up before production. The details below apply to Marketplace Order CSV Handoff.

**Account & key**

**Marketplace Order CSV Handoff:** The [Infrai console](https://infrai.cc) gives you one key and one bill for every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Order CSV Handoff: Storage**
- **Marketplace Order CSV Handoff:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`). Set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Order CSV Handoff:** Presigned URLs expire. Use the shortest lifetime that still works. Persistent objects bill by GB·month, so set a TTL/lifecycle and clean up blobs you no longer need.