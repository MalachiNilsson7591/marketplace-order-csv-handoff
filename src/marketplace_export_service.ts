import { createServer } from "node:http";
import { ZodError } from "zod";
import { handoffRequestSchema, infraiExportStorage, publishOrderHandoff } from "./order_handoff.js";
import { InfraiError } from "./infrai_storage.js";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/exports/order-handoff") {
    json(response, 404, { error: "route_not_found" });
    return;
  }
  try {
    const input = handoffRequestSchema.parse(await readJson(request));
    const result = await publishOrderHandoff(input, infraiExportStorage);
    json(response, result.published ? 201 : 409, result);
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "invalid_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError && error.status < 500) {
      json(response, error.status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "export_failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Marketplace export service listening on http://localhost:${port}`));
