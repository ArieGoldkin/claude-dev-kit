import { describe, it, expect, vi, beforeEach } from "vitest";

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
  stitch: {},
}));

import { registerTools } from "../tools.js";

// --- Test helpers ---

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();
  return {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      tools.set(name, handler);
    }),
    tools,
  };
}

function createMockStitch() {
  const mockScreen = {
    id: "screen-1",
    screenId: "sc-1",
    edit: vi.fn(),
    variants: vi.fn(),
    getHtml: vi.fn(),
    getImage: vi.fn(),
  };

  const mockProject = {
    screens: vi.fn().mockResolvedValue([mockScreen]),
    generate: vi.fn().mockResolvedValue(mockScreen),
    getScreen: vi.fn().mockResolvedValue(mockScreen),
  };

  const mockStitch = {
    projects: vi.fn().mockResolvedValue([
      { id: "proj-1", data: { title: "My Project" } },
    ]),
    createProject: vi.fn().mockResolvedValue({
      id: "proj-new",
      data: { title: "New Project" },
    }),
    project: vi.fn().mockReturnValue(mockProject),
    callTool: vi.fn().mockResolvedValue({ colors: ["#fff"] }),
  };

  return { stitch: mockStitch, project: mockProject, screen: mockScreen };
}

function parseJson(result: unknown): unknown {
  const r = result as { content: { type: string; text: string }[] };
  return JSON.parse(r.content[0].text);
}

function getText(result: unknown): string {
  const r = result as { content: { type: string; text: string }[] };
  return r.content[0].text;
}

function isError(result: unknown): boolean {
  return (result as { isError?: boolean }).isError === true;
}

// --- Tests ---

describe("registerTools", () => {
  let server: ReturnType<typeof createMockServer>;
  let mocks: ReturnType<typeof createMockStitch>;
  let handler: (name: string) => ToolHandler;

  beforeEach(() => {
    server = createMockServer();
    mocks = createMockStitch();
    registerTools(server as any, mocks.stitch as any);

    handler = (name: string) => {
      const h = server.tools.get(name);
      if (!h) throw new Error(`Tool "${name}" not registered`);
      return h;
    };
  });

  it("registers all expected tools", () => {
    const expected = [
      "stitch_list_projects",
      "stitch_create_project",
      "stitch_get_project",
      "stitch_list_screens",
      "stitch_generate",
      "stitch_edit",
      "stitch_generate_variants",
      "stitch_get_html",
      "stitch_get_image",
      "stitch_extract_design",
    ];
    for (const name of expected) {
      expect(server.tools.has(name), `missing tool: ${name}`).toBe(true);
    }
  });

  // --- stitch_list_projects ---

  describe("stitch_list_projects", () => {
    it("returns projects list on success", async () => {
      const result = await handler("stitch_list_projects")({});
      const data = parseJson(result) as { projects: { id: string; name: string }[] };
      expect(data.projects).toEqual([{ id: "proj-1", name: "My Project" }]);
      expect(mocks.stitch.projects).toHaveBeenCalled();
    });

    it("returns isError on failure", async () => {
      mocks.stitch.projects.mockRejectedValueOnce(new Error("network down"));
      const result = await handler("stitch_list_projects")({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("network down");
    });

    it("formats StitchError with code", async () => {
      mocks.stitch.projects.mockRejectedValueOnce(
        new MockStitchError("bad key", "AUTH_FAILED")
      );
      const result = await handler("stitch_list_projects")({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Authentication failed");
      expect(getText(result)).toContain("AUTH_FAILED");
    });
  });

  // --- stitch_create_project ---

  describe("stitch_create_project", () => {
    it("creates project with title", async () => {
      const result = await handler("stitch_create_project")({ title: "Test Project" });
      const data = parseJson(result) as { id: string; name: string };
      expect(mocks.stitch.createProject).toHaveBeenCalledWith("Test Project");
      expect(data.id).toBe("proj-new");
      expect(data.name).toBe("New Project");
    });

    it("creates project without title, returns Untitled", async () => {
      mocks.stitch.createProject.mockResolvedValueOnce({
        id: "proj-untitled",
        data: { title: undefined },
      });
      const result = await handler("stitch_create_project")({});
      const data = parseJson(result) as { id: string; name: string };
      expect(mocks.stitch.createProject).toHaveBeenCalledWith(undefined);
      expect(data.id).toBe("proj-untitled");
      expect(data.name).toBe("Untitled");
    });

    it("returns isError on failure", async () => {
      mocks.stitch.createProject.mockRejectedValueOnce(new Error("quota exceeded"));
      const result = await handler("stitch_create_project")({ title: "X" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("quota exceeded");
    });
  });

  // --- stitch_get_project ---

  describe("stitch_get_project", () => {
    it("calls callTool with correct resource name", async () => {
      const result = await handler("stitch_get_project")({ project_id: "proj-1" });
      expect(mocks.stitch.callTool).toHaveBeenCalledWith("get_project", {
        name: "projects/proj-1",
      });
      const data = parseJson(result) as Record<string, unknown>;
      expect(data.colors).toEqual(["#fff"]);
    });

    it("returns isError on failure", async () => {
      mocks.stitch.callTool.mockRejectedValueOnce(
        new MockStitchError("not found", "NOT_FOUND")
      );
      const result = await handler("stitch_get_project")({ project_id: "bad-id" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Resource not found");
    });
  });

  // --- stitch_list_screens ---

  describe("stitch_list_screens", () => {
    it("returns screens list on success", async () => {
      const result = await handler("stitch_list_screens")({ project_id: "proj-1" });
      const data = parseJson(result) as { screens: { id: string; screen_id: string }[] };
      expect(mocks.stitch.project).toHaveBeenCalledWith("proj-1");
      expect(mocks.project.screens).toHaveBeenCalled();
      expect(data.screens).toEqual([{ id: "screen-1", screen_id: "sc-1" }]);
    });

    it("returns isError on failure", async () => {
      mocks.project.screens.mockRejectedValueOnce(new Error("timeout"));
      const result = await handler("stitch_list_screens")({ project_id: "proj-1" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("timeout");
    });
  });

  // --- stitch_generate ---

  describe("stitch_generate", () => {
    it("generates screen with all parameters", async () => {
      const result = await handler("stitch_generate")({
        project_id: "proj-1",
        prompt: "A dashboard",
        device_type: "MOBILE",
        model_id: "GEMINI_3_PRO",
      });
      expect(mocks.stitch.project).toHaveBeenCalledWith("proj-1");
      expect(mocks.project.generate).toHaveBeenCalledWith(
        "A dashboard",
        "MOBILE",
        "GEMINI_3_PRO"
      );
      const data = parseJson(result) as { id: string; screen_id: string };
      expect(data.id).toBe("screen-1");
      expect(data.screen_id).toBe("sc-1");
    });

    it("generates screen without model_id", async () => {
      await handler("stitch_generate")({
        project_id: "proj-1",
        prompt: "A form",
        device_type: "DESKTOP",
      });
      expect(mocks.project.generate).toHaveBeenCalledWith(
        "A form",
        "DESKTOP",
        undefined
      );
    });

    it("returns isError on failure", async () => {
      mocks.project.generate.mockRejectedValueOnce(
        new MockStitchError("rate limited", "RATE_LIMITED")
      );
      const result = await handler("stitch_generate")({
        project_id: "proj-1",
        prompt: "test",
        device_type: "DESKTOP",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Rate limit exceeded");
    });
  });

  // --- stitch_edit ---

  describe("stitch_edit", () => {
    it("edits screen with all parameters", async () => {
      const updatedScreen = { id: "screen-2", screenId: "sc-2" };
      mocks.screen.edit.mockResolvedValueOnce(updatedScreen);

      const result = await handler("stitch_edit")({
        project_id: "proj-1",
        screen_id: "sc-1",
        prompt: "Make header blue",
        device_type: "TABLET",
        model_id: "GEMINI_3_FLASH",
      });

      expect(mocks.stitch.project).toHaveBeenCalledWith("proj-1");
      expect(mocks.project.getScreen).toHaveBeenCalledWith("sc-1");
      expect(mocks.screen.edit).toHaveBeenCalledWith(
        "Make header blue",
        "TABLET",
        "GEMINI_3_FLASH"
      );
      const data = parseJson(result) as { id: string; screen_id: string; edit_prompt: string };
      expect(data.id).toBe("screen-2");
      expect(data.screen_id).toBe("sc-2");
      expect(data.edit_prompt).toBe("Make header blue");
    });

    it("returns isError on failure", async () => {
      mocks.screen.edit.mockRejectedValueOnce(new Error("server error 500"));
      const result = await handler("stitch_edit")({
        project_id: "proj-1",
        screen_id: "sc-1",
        prompt: "change color",
        device_type: "DESKTOP",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("server error 500");
    });
  });

  // --- stitch_generate_variants ---

  describe("stitch_generate_variants", () => {
    it("generates variants with correct mapped options", async () => {
      const variantScreens = [
        { id: "v1", screenId: "vs-1" },
        { id: "v2", screenId: "vs-2" },
      ];
      mocks.screen.variants.mockResolvedValueOnce(variantScreens);

      const result = await handler("stitch_generate_variants")({
        project_id: "proj-1",
        screen_ids: ["sc-1", "sc-2"],
        prompt: "Explore colors",
        variant_options: {
          variant_count: 2,
          creative_range: "EXPLORE",
          aspects: ["COLOR_SCHEME", "LAYOUT"],
        },
        device_type: "DESKTOP",
        model_id: "GEMINI_3_PRO",
      });

      expect(mocks.stitch.project).toHaveBeenCalledWith("proj-1");
      expect(mocks.project.getScreen).toHaveBeenCalledWith("sc-1");
      expect(mocks.screen.variants).toHaveBeenCalledWith(
        "Explore colors",
        {
          variantCount: 2,
          creativeRange: "EXPLORE",
          aspects: ["COLOR_SCHEME", "LAYOUT"],
          selectedScreenIds: ["sc-1", "sc-2"],
        },
        "DESKTOP",
        "GEMINI_3_PRO"
      );

      const data = parseJson(result) as { variants: unknown[]; count: number; prompt: string };
      expect(data.variants).toEqual([
        { id: "v1", screen_id: "vs-1" },
        { id: "v2", screen_id: "vs-2" },
      ]);
      expect(data.count).toBe(2);
      expect(data.prompt).toBe("Explore colors");
    });

    it("returns isError on failure", async () => {
      mocks.screen.variants.mockRejectedValueOnce(new Error("variant generation failed"));
      const result = await handler("stitch_generate_variants")({
        project_id: "proj-1",
        screen_ids: ["sc-1"],
        prompt: "test",
        variant_options: {
          variant_count: 1,
          creative_range: "REFINE",
          aspects: ["LAYOUT"],
        },
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("variant generation failed");
    });
  });

  // --- stitch_get_html ---

  describe("stitch_get_html", () => {
    it("returns HTML string on success", async () => {
      mocks.screen.getHtml.mockResolvedValueOnce("<html><body>Hello</body></html>");

      const result = await handler("stitch_get_html")({
        project_id: "proj-1",
        screen_id: "sc-1",
      });

      expect(mocks.stitch.project).toHaveBeenCalledWith("proj-1");
      expect(mocks.project.getScreen).toHaveBeenCalledWith("sc-1");
      expect(mocks.screen.getHtml).toHaveBeenCalled();
      expect(getText(result)).toBe("<html><body>Hello</body></html>");
    });

    it("returns isError on failure", async () => {
      mocks.screen.getHtml.mockRejectedValueOnce(new Error("html export failed"));
      const result = await handler("stitch_get_html")({
        project_id: "proj-1",
        screen_id: "sc-1",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("html export failed");
    });
  });

  // --- stitch_get_image ---

  describe("stitch_get_image", () => {
    it("returns image URL on success", async () => {
      mocks.screen.getImage.mockResolvedValueOnce("https://stitch.google/img/abc.png");

      const result = await handler("stitch_get_image")({
        project_id: "proj-1",
        screen_id: "sc-1",
      });

      expect(mocks.stitch.project).toHaveBeenCalledWith("proj-1");
      expect(mocks.project.getScreen).toHaveBeenCalledWith("sc-1");
      expect(mocks.screen.getImage).toHaveBeenCalled();
      expect(getText(result)).toBe("https://stitch.google/img/abc.png");
    });

    it("returns isError on failure", async () => {
      mocks.screen.getImage.mockRejectedValueOnce(
        new MockStitchError("permission denied", "PERMISSION_DENIED")
      );
      const result = await handler("stitch_get_image")({
        project_id: "proj-1",
        screen_id: "sc-1",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Authentication failed");
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });
  });

  // --- stitch_extract_design ---

  describe("stitch_extract_design", () => {
    it("calls callTool with extract_design_context", async () => {
      mocks.stitch.callTool.mockResolvedValueOnce({
        fonts: ["Inter"],
        colors: ["#000", "#fff"],
        spacing: { base: 8 },
      });

      const result = await handler("stitch_extract_design")({
        project_id: "proj-1",
        screen_id: "sc-1",
      });

      expect(mocks.stitch.callTool).toHaveBeenCalledWith("extract_design_context", {
        projectId: "proj-1",
        screenId: "sc-1",
      });
      const data = parseJson(result) as Record<string, unknown>;
      expect(data.fonts).toEqual(["Inter"]);
      expect(data.colors).toEqual(["#000", "#fff"]);
    });

    it("returns isError on failure", async () => {
      mocks.stitch.callTool.mockRejectedValueOnce(new Error("extraction failed"));
      const result = await handler("stitch_extract_design")({
        project_id: "proj-1",
        screen_id: "sc-1",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("extraction failed");
    });
  });

  // --- Error handling edge cases ---

  describe("error handling edge cases", () => {
    it("handles HTTP 401 in error message", async () => {
      mocks.stitch.projects.mockRejectedValueOnce(new Error("Request failed with status 401"));
      const result = await handler("stitch_list_projects")({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Authentication failed");
    });

    it("handles HTTP 429 in error message", async () => {
      mocks.stitch.projects.mockRejectedValueOnce(new Error("Request failed with status 429"));
      const result = await handler("stitch_list_projects")({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Rate limit exceeded");
    });

    it("handles HTTP 404 in error message", async () => {
      mocks.stitch.projects.mockRejectedValueOnce(new Error("Request failed with status 404"));
      const result = await handler("stitch_list_projects")({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Resource not found");
    });

    it("handles non-Error thrown values", async () => {
      mocks.stitch.projects.mockRejectedValueOnce("string error");
      const result = await handler("stitch_list_projects")({});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("string error");
    });
  });
});
