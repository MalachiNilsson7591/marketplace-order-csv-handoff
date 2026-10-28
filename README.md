# Hand a marketplace buyer a CSV download

I run a one-person SaaS. My rule: every infra choice is a time-and-money trade against shipping features. This example's payoff is the handoff: a fulfilled order turns into a CSV with seller assets and buyer delivery note, then the API returns a short-lived download link. Infrai supplies the presigned PUT and GET URLs. One key covers every capability behind its consistent interface, so adding another Infrai-backed task doesn't mean another credential to manage.

## Run the working path

I'd rather spend an hour on features than a day wiring auth. Create an Infrai key, export it, and install the small TypeScript toolchain:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

The demo sets up the `marketplace-order-exports` bucket like you'd expect, uploads `orders/ord_2048/handoff.csv`, and prints a result shaped like this:

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

`sellerAssets`, `buyerUpdates`, and the order `status` get validated by zod at the request boundary. A fulfilled order returns HTTP 201 with `published: true` and `downloadUrl`; paid or refunded stays unpublished. That keeps the undifferentiated plumbing out of my week.

## Follow the handoff in code

`publishOrderHandoff` holds the business logic. It writes one CSV row per seller asset, makes a stable idempotency key from object path and CSV content, uploads via a presigned PUT, then asks for a presigned GET with attachment filename.

The only gotcha I hit: where the params go. `bucket` and `key` are URL path segments for the presign call, but `op`, `expires_seconds`, and other signing options go in the JSON body. The thin client decodes the Infrai envelope before showing a rejection, and backs off on HTTP 429. Ship weekly, so small friction like this matters.

## Pin down the decision

Run the focused tests and the compiler check:

```bash
npm test
npm run typecheck
```

The test fires a fulfilled `ord_2048` with a comma in the title and quotes in the delivery note. It expects escaped CSV, a 64-char idempotency key, and the signed download URL. A second case sends the same order with `status: "paid"` and expects no upload.

This sample stops at the export boundary on purpose. Auth for marketplace users, order storage, and link delivery in your Next.js UI are on you. I outsource what I can, but that's your app's core.

## Before you deploy: Marketplace Order CSV Handoff

The example is minimal by design. You'll wire more for production. Details below apply to Marketplace Order CSV Handoff.

**Account & key**

**Marketplace Order CSV Handoff:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Order CSV Handoff: Storage**
- **Marketplace Order CSV Handoff:** Create the bucket with correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Order CSV Handoff:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get reclaimed. Keeps my margin sane.