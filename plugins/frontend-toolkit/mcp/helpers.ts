import { StitchError } from "@google/stitch-sdk";

export function handleError(error: unknown): string {
  // Use structured StitchError codes when available
  if (error instanceof StitchError) {
    const code = error.code;
    if (code === "AUTH_FAILED" || code === "PERMISSION_DENIED") {
      return `Error: Authentication failed (${code}). Verify STITCH_API_KEY is valid. Generate a new key at stitch.withgoogle.com → Settings → API Keys.`;
    }
    if (code === "RATE_LIMITED") {
      return `Error: Rate limit exceeded. Stitch allows 350 generations/month (Standard) or 50/month (Experimental). Wait or switch modes.`;
    }
    if (code === "NOT_FOUND") {
      return `Error: Resource not found. Check that the project/screen ID is correct. Use stitch_list_projects or stitch_list_screens to find valid IDs.`;
    }
    return `Error: Stitch API error (${code}): ${error.message}`;
  }

  // Fallback for non-StitchError exceptions
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("401") || msg.includes("403")) {
    return `Error: Authentication failed. Verify STITCH_API_KEY is valid. Generate a new key at stitch.withgoogle.com → Settings → API Keys.`;
  }
  if (msg.includes("429")) {
    return `Error: Rate limit exceeded. Stitch allows 350 generations/month (Standard) or 50/month (Experimental). Wait or switch modes.`;
  }
  if (msg.includes("404")) {
    return `Error: Resource not found. Check that the project/screen ID is correct. Use stitch_list_projects or stitch_list_screens to find valid IDs.`;
  }
  return `Error: ${msg}`;
}

export function errorResult(error: unknown) {
  return { isError: true as const, content: [{ type: "text" as const, text: handleError(error) }] };
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonResult(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
