import { handoffRequestSchema, infraiExportStorage, publishOrderHandoff } from "../src/order_handoff.js";

const request = handoffRequestSchema.parse({
  orderId: "ord_2048",
  status: "fulfilled",
  sellerAssets: [
    { sku: "ICON-PACK", title: "Interface icon pack", assetUrl: "https://seller.example/assets/icons.zip" },
    { sku: "FONT-LICENSE", title: "Font license", assetUrl: "https://seller.example/assets/license.pdf" }
  ],
  buyerUpdates: {
    email: "buyer@example.com",
    deliveryNote: "Includes the extended marketplace license."
  }
});

console.log(await publishOrderHandoff(request, infraiExportStorage));
