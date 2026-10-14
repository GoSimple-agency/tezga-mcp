#!/usr/bin/env node
// Lokalni (stdio) MCP server: radi u Claude Code, Cursor, Codex i svakom MCP
// klijentu koji pokreće komandu. Ključ dolazi iz TEZGA_API_KEY.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TezgaKlijent, PODRAZUMEVANI_BAZNI_URL } from "./api.js";
import { registrujAlate } from "./tools.js";

const server = new McpServer({ name: "tezga", version: "0.1.0" });

registrujAlate(
  server,
  new TezgaKlijent({
    apiKljuc: process.env.TEZGA_API_KEY ?? "",
    bazniUrl: process.env.TEZGA_BASE_URL ?? PODRAZUMEVANI_BAZNI_URL,
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
