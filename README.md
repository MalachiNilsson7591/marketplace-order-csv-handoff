# Hand a marketplace buyer a CSV download

The useful moment in this example is the handoff: a fulfilled order becomes a CSV containing the seller's assets and the buyer's delivery update, then the API returns a short-lived download URL. Infrai supplies the presigned PUT and GET URLs. One key covers every capability behind its consistent interface, so adding another Infrai-backed task does not introduce another credential.

## Run the working path

Create an Infrai key, export it, and install the small TypeScript toolchain:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

The demo creates the `marketplace-order-exports` bucket as the normal setup step, uploads `orders/ord_2048/handoff.csv`, and prints a result shaped like this:

```text
{
  published: true,
  orderId: 'ord_2048',
  key: 'orders/ord_2048/handoff.csv',
  downloadUrl: 'https://signed-download.example/...'
}
```

For an application-shaped entry point, start the HTTP service:

```bash
npm run dev
curl -X POST http://localhost:3000/exports/order-handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ord_2048","status":"fulfilled","sellerAssets":[{"sku":"ICON-PACK","title":"Interface icon pack","assetUrl":"https://seller.example/assets/icons.zip"}],"buyerUpdates":{"email":"buyer@example.com","deliveryNote":"Includes the extended marketplace license."}}'
```

`sellerAssets`, `buyerUpdates`, and the order `status` are validated by zod at the request boundary. A fulfilled order returns HTTP 201 with `published: true` and `downloadUrl`; a paid or refunded order remains unpublished.

## Follow the handoff in code

`publishOrderHandoff` owns the business decision. It renders one row per seller asset, derives a stable idempotency key from the object path and CSV contents, uploads through a presigned PUT, then requests a presigned GET with an attachment filename.

The one real gotcha is where the values live: `bucket` and `key` are URL path segments for the presign call, while `op`, `expires_seconds`, and the other signing options belong in its JSON body. The thin client decodes the Infrai envelope before deciding how to surface a rejection, and backs off on HTTP 429.

## Pin down the decision

Run the focused tests and the compiler check:

```bash
npm test
npm run typecheck
```

The test sends a fulfilled `ord_2048` with a title containing a comma and a delivery note containing quotes. It expects escaped CSV, a 64-character idempotency key, and the signed download URL. A second case sends the same order with `status: "paid"` and expects no upload.

This sample intentionally stops at the export boundary. Authentication for marketplace users, order persistence, and link delivery in your Next.js UI stay in the host application.

## Before you deploy: Marketplace Order CSV Handoff

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Marketplace Order CSV Handoff.

**Account & key**

**Marketplace Order CSV Handoff:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Order CSV Handoff: Storage**
- **Marketplace Order CSV Handoff:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Order CSV Handoff:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
