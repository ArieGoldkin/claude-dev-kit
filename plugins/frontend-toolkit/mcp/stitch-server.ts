#!/usr/bin/env node
/**
 * MCP Server for Google Stitch AI UI generation.
 *
 * Wraps @google/stitch-sdk as a stdio MCP server so Claude Code
 * can generate, read, edit, and export Stitch designs natively.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { stitch } from "@google/stitch-sdk";
import { execSync } from "node:child_process";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "stitch-mcp-server",
  version: "1.0.0",
});

registerTools(server, stitch);

/**
 * Resolve STITCH_API_KEY: env var first, then 1Password CLI fallback.
 */
function resolveApiKey(): string {
  if (process.env.STITCH_API_KEY) {
    return process.env.STITCH_API_KEY;
  }

  // Try common op locations — MCP servers may not inherit shell PATH
  const opPaths = ["/opt/homebrew/bin/op", "/usr/local/bin/op", "op"];
  for (const opBin of opPaths) {
    try {
      const key = execSync(
        `${opBin} item get "Google Stitch API Key" --field credential --reveal`,
        { timeout: 10_000, stdio: ["pipe", "pipe", "pipe"] }
      ).toString().trim();
      if (key) {
        process.env.STITCH_API_KEY = key;
        console.error(`stitch-mcp-server: resolved API key from 1Password (${opBin})`);
        return key;
      }
    } catch {
      // This op path didn't work — try next
    }
  }

  console.error(
    "ERROR: STITCH_API_KEY not found.\n" +
      "Set the env var or install 1Password CLI with the item 'Google Stitch API Key'.\n" +
      "Generate a key at: stitch.withgoogle.com → Settings → API Keys"
  );
  process.exit(1);
}

async function main() {
  resolveApiKey();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("stitch-mcp-server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
