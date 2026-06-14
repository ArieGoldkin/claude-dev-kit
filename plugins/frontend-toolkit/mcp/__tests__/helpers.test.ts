import { describe, it, expect, vi } from "vitest";

const { MockStitchError } = vi.hoisted(() => {
  class MockStitchError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = "StitchError";
    }
  }
  return { MockStitchError };
});

vi.mock("@google/stitch-sdk", () => ({
  StitchError: MockStitchError,
}));

import { handleError, errorResult, textResult, jsonResult } from "../helpers.js";

describe("handleError", () => {
  it("returns authentication message for StitchError with AUTH_FAILED", () => {
    const err = new MockStitchError("auth failed", "AUTH_FAILED");
    expect(handleError(err)).toContain("Authentication failed");
  });

  it("returns authentication message for StitchError with PERMISSION_DENIED", () => {
    const err = new MockStitchError("no permission", "PERMISSION_DENIED");
    expect(handleError(err)).toContain("Authentication failed");
  });

  it("returns rate limit message for StitchError with RATE_LIMITED", () => {
    const err = new MockStitchError("too many requests", "RATE_LIMITED");
    expect(handleError(err)).toContain("Rate limit exceeded");
  });

  it("returns not found message for StitchError with NOT_FOUND", () => {
    const err = new MockStitchError("missing resource", "NOT_FOUND");
    expect(handleError(err)).toContain("Resource not found");
  });

  it("includes code and message for StitchError with unknown code", () => {
    const err = new MockStitchError("something broke", "INTERNAL");
    const result = handleError(err);
    expect(result).toContain("INTERNAL");
    expect(result).toContain("something broke");
  });

  it("returns authentication message for regular Error with 401 in message", () => {
    const err = new Error("Request failed with status 401");
    expect(handleError(err)).toContain("Authentication failed");
  });

  it("returns authentication message for regular Error with 403 in message", () => {
    const err = new Error("Forbidden 403 error");
    expect(handleError(err)).toContain("Authentication failed");
  });

  it("returns rate limit message for regular Error with 429 in message", () => {
    const err = new Error("HTTP 429 too many requests");
    expect(handleError(err)).toContain("Rate limit exceeded");
  });

  it("returns not found message for regular Error with 404 in message", () => {
    const err = new Error("Got 404 from server");
    expect(handleError(err)).toContain("Resource not found");
  });

  it("returns generic error message for regular Error with no status code", () => {
    const err = new Error("something unexpected");
    expect(handleError(err)).toContain("Error: something unexpected");
  });

  it("returns error message for non-Error value (string)", () => {
    expect(handleError("raw string error")).toContain("Error: raw string error");
  });
});

describe("errorResult", () => {
  it("returns object with isError true", () => {
    const result = errorResult(new Error("fail"));
    expect(result.isError).toBe(true);
  });

  it("returns content array with single text entry", () => {
    const result = errorResult(new Error("fail"));
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("text contains the handleError output", () => {
    const err = new Error("specific problem");
    const result = errorResult(err);
    expect(result.content[0].text).toContain(handleError(err));
  });
});

describe("textResult", () => {
  it("returns content array with the provided text", () => {
    const result = textResult("hello world");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe("hello world");
  });

  it("content entry has type text", () => {
    const result = textResult("test");
    expect(result.content[0].type).toBe("text");
  });
});

describe("jsonResult", () => {
  it("returns content with pretty-printed JSON", () => {
    const data = { key: "value", num: 42 };
    const result = jsonResult(data);
    expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
  });

  it("parses back to original data", () => {
    const data = { nested: { a: 1 }, list: [1, 2, 3] };
    const result = jsonResult(data);
    expect(JSON.parse(result.content[0].text)).toEqual(data);
  });
});
