// Remote (Streamable HTTP) MCP server: ovo Claude dodaje kao „custom connector"
// po URL-u. Radi bez stanja (stateless): svaki POST na /mcp dobija svoj server i
// transport. Ključ se čita iz zaglavlja X-Tezga-Api-Key ili Authorization:
// Bearer, pa jedan endpoint opslužuje više naloga.
//
// NAPOMENA (Staza B): za ulazak u Claude connector directory treba OAuth 2.1.
// Ovaj fajl je transport sloj spreman za deploy; OAuth sloj je sledeći korak
// (vidi README, „Put do direktorijuma"). Za MCP registar i interni tim ovaj
// ključ-kroz-zaglavlje model je dovoljan.
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TezgaKlijent, PODRAZUMEVANI_BAZNI_URL } from "./api.js";
import { registrujAlate } from "./tools.js";

const PORT = Number(process.env.PORT ?? 8787);
const PUTANJA = process.env.MCP_PATH ?? "/mcp";

function kljucIzZahteva(req: http.IncomingMessage): string {
  const x = req.headers["x-tezga-api-key"];
  if (typeof x === "string" && x) return x;
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return process.env.TEZGA_API_KEY ?? "";
}

function citajTelo(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const delovi: Buffer[] = [];
    req.on("data", (d) => delovi.push(d as Buffer));
    req.on("end", () => {
      const sirovo = Buffer.concat(delovi).toString("utf8");
      if (!sirovo) return resolve(undefined);
      try {
        resolve(JSON.parse(sirovo));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const httpServer = http.createServer(async (req, res) => {
  // CORS (MCP klijenti u pregledaču traže ova zaglavlja).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Tezga-Api-Key, Mcp-Session-Id, MCP-Protocol-Version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const putanja = (req.url ?? "").split("?")[0];

  if (putanja === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ime: "tezga-mcp" }));
    return;
  }

  if (putanja !== PUTANJA) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  const server = new McpServer({ name: "tezga", version: "0.1.0" });
  registrujAlate(
    server,
    new TezgaKlijent({
      apiKljuc: kljucIzZahteva(req),
      bazniUrl: process.env.TEZGA_BASE_URL ?? PODRAZUMEVANI_BAZNI_URL,
    }),
  );

  // Stateless: nema sesije, svaki zahtev je sam za sebe.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    const telo = req.method === "POST" ? await citajTelo(req) : undefined;
    await transport.handleRequest(req, res, telo);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Interna greška servera" },
          id: null,
        }),
      );
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`tezga-mcp (Streamable HTTP) sluša na :${PORT}${PUTANJA}`);
});
