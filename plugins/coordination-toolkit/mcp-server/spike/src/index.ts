/**
 * CT-01 Spike: Minimal MCP server to verify notifications/claude/channel delivery.
 *
 * Tests two scenarios:
 * 1. Tool-triggered: call `ping` tool → sends a channel notification
 * 2. Timer-triggered: every 10s, sends a channel notification (tests push without user action)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "coordination-channel-spike", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
  }
);

let notificationCount = 0;

async function pushChannelNotification(content: string, meta?: Record<string, unknown>): Promise<boolean> {
  try {
    await server.notification({
      method: "notifications/claude/channel",
      params: { content, meta: meta ?? {} },
    });
    notificationCount++;
    process.stderr.write(`[spike] Channel notification #${notificationCount} sent: ${content}\n`);
    return true;
  } catch (err) {
    process.stderr.write(`[spike] Channel notification FAILED: ${err}\n`);
    return false;
  }
}

// Tool: ping — sends a channel notification when called
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "spike_ping",
      description:
        "Test channel notification delivery. Sends a message via notifications/claude/channel and reports whether it succeeded.",
      inputSchema: {
        type: "object" as const,
        properties: {
          message: {
            type: "string",
            description: "Message to send via channel notification",
            default: "ping from coordination-channel-spike",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "spike_ping") {
    const message =
      (request.params.arguments as Record<string, string>)?.message ??
      "ping from coordination-channel-spike";

    const ok = await pushChannelNotification(message, {
      source: "spike_ping_tool",
      sent_at: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: ok
            ? `Channel notification sent successfully (#${notificationCount}): "${message}"`
            : `Channel notification FAILED. Check stderr for details.`,
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Timer: push a notification every 10 seconds to test idle delivery
const TIMER_INTERVAL_MS = 10_000;
let timerHandle: ReturnType<typeof setInterval> | null = null;

function startTimer(): void {
  timerHandle = setInterval(async () => {
    await pushChannelNotification(
      `[auto] Timer notification #${notificationCount + 1} at ${new Date().toISOString()}`,
      { source: "timer", interval_ms: TIMER_INTERVAL_MS }
    );
  }, TIMER_INTERVAL_MS);
}

// Startup
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[spike] MCP server started. Timer notifications every 10s.\n");
  startTimer();

  // Cleanup on exit
  process.on("SIGINT", () => {
    if (timerHandle) clearInterval(timerHandle);
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    if (timerHandle) clearInterval(timerHandle);
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[spike] Fatal error: ${err}\n`);
  process.exit(1);
});
