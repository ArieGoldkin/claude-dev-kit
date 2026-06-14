import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Project, Screen } from "@google/stitch-sdk";
import { errorResult, jsonResult, textResult } from "./helpers.js";
import {
  DeviceTypeSchema,
  ModelIdSchema,
  ProjectIdSchema,
  ScreenIdSchema,
  PromptSchema,
  VariantOptionsSchema,
  type DeviceType,
  type ModelIdType,
} from "./schemas.js";
import { z } from "zod";

export function registerTools(
  server: McpServer,
  stitchInstance: { projects: Function; createProject: Function; project: Function; callTool: Function }
) {
  // 1. List projects
  server.registerTool(
    "stitch_list_projects",
    {
      title: "List Stitch Projects",
      description:
        "List all Stitch projects accessible with the current API key. Returns project IDs and names. Use this first to find a project ID for other operations.",
      inputSchema: {
        filter: z.enum(["owned", "shared"]).optional().describe("Filter: owned or shared projects"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ filter }: { filter?: string }) => {
      try {
        // SDK v0.0.3 doesn't support filter param — list all, filter client-side if needed
        const projects = await stitchInstance.projects();
        const items = projects.map((p: Project) => ({ id: p.id, name: p.data?.title ?? p.id }));
        return jsonResult({ projects: items });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 1b. Create project
  server.registerTool(
    "stitch_create_project",
    {
      title: "Create Stitch Project",
      description: "Create a new Stitch project. Returns the project ID and title.",
      inputSchema: {
        title: z.string().max(100).optional().describe("Project title. Defaults to 'Untitled'."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ title }: { title?: string }) => {
      try {
        const project = await stitchInstance.createProject(title);
        return jsonResult({ id: project.id, name: project.data?.title ?? title ?? "Untitled" });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 1c. Get project
  server.registerTool(
    "stitch_get_project",
    {
      title: "Get Stitch Project",
      description:
        "Get details of a specific Stitch project by ID. Returns the project metadata including title and settings.",
      inputSchema: {
        project_id: ProjectIdSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ project_id }: { project_id: string }) => {
      try {
        const result = await stitchInstance.callTool("get_project", { name: "projects/" + project_id });
        return jsonResult(result as Record<string, unknown>);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 2. List screens
  server.registerTool(
    "stitch_list_screens",
    {
      title: "List Screens in Project",
      description:
        "List all screens in a Stitch project. Returns screen IDs. Use to browse existing designs or find a screen ID for get_html/get_image/edit.",
      inputSchema: {
        project_id: ProjectIdSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ project_id }: { project_id: string }) => {
      try {
        const project = stitchInstance.project(project_id);
        const screens = await project.screens();
        const items = screens.map((sc: Screen) => ({ id: sc.id, screen_id: sc.screenId }));
        return jsonResult({ screens: items });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 3. Generate screen
  server.registerTool(
    "stitch_generate",
    {
      title: "Generate UI Screen",
      description:
        "Generate a new UI screen design from a text prompt using Stitch AI (Gemini-powered). Returns the new screen object with its ID. Use stitch_get_html or stitch_get_image to retrieve the output.",
      inputSchema: {
        project_id: ProjectIdSchema,
        prompt: z
          .string()
          .min(3, "Prompt must be at least 3 characters")
          .describe("Text description of the UI to generate, e.g. 'A modern dashboard with sidebar navigation and analytics charts'"),
        device_type: DeviceTypeSchema,
        model_id: ModelIdSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ project_id, prompt, device_type, model_id }: { project_id: string; prompt: string; device_type: string; model_id?: string }) => {
      try {
        const project = stitchInstance.project(project_id);
        const screen = await project.generate(
          prompt,
          device_type as DeviceType,
          model_id as ModelIdType
        );
        return jsonResult({ id: screen.id, screen_id: screen.screenId, prompt, device_type });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 4. Edit screen
  server.registerTool(
    "stitch_edit",
    {
      title: "Edit Existing Screen",
      description:
        "Edit an existing Stitch screen with a follow-up prompt. Modifies the design in place. Use after stitch_generate or stitch_list_screens to refine a design iteratively.",
      inputSchema: {
        project_id: ProjectIdSchema,
        screen_id: ScreenIdSchema,
        prompt: z
          .string()
          .min(3, "Edit prompt must be at least 3 characters")
          .describe("Edit instruction, e.g. 'Change the header to dark blue and add a search bar'"),
        device_type: DeviceTypeSchema,
        model_id: ModelIdSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ project_id, screen_id, prompt, device_type, model_id }: { project_id: string; screen_id: string; prompt: string; device_type: string; model_id?: string }) => {
      try {
        const project = stitchInstance.project(project_id);
        const screen = await project.getScreen(screen_id);
        const updated = await screen.edit(
          prompt,
          device_type as DeviceType,
          model_id as ModelIdType
        );
        return jsonResult({ id: updated.id, screen_id: updated.screenId, edit_prompt: prompt });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 4b. Generate variants
  server.registerTool(
    "stitch_generate_variants",
    {
      title: "Generate Design Variants",
      description:
        "Generate multiple design variants of existing screens. Specify creative range " +
        "(REFINE for tweaks, EXPLORE for moderate changes, REIMAGINE for radical). " +
        "Choose which aspects to vary: LAYOUT, COLOR_SCHEME, IMAGES, TEXT_FONT, TEXT_CONTENT.",
      inputSchema: {
        project_id: ProjectIdSchema,
        screen_ids: z.array(z.string().min(1)).min(1).max(20).describe("Screen IDs to generate variants from"),
        prompt: PromptSchema,
        variant_options: VariantOptionsSchema,
        device_type: DeviceTypeSchema.optional(),
        model_id: ModelIdSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ project_id, screen_ids, prompt, variant_options, device_type, model_id }: {
      project_id: string;
      screen_ids: string[];
      prompt: string;
      variant_options: { variant_count: number; creative_range: string; aspects: string[] };
      device_type?: string;
      model_id?: string;
    }) => {
      try {
        const project = stitchInstance.project(project_id);
        const screen = await project.getScreen(screen_ids[0]);
        const variants = await screen.variants(
          prompt,
          {
            variantCount: variant_options.variant_count,
            creativeRange: variant_options.creative_range,
            aspects: variant_options.aspects,
            selectedScreenIds: screen_ids,
          },
          device_type as DeviceType | undefined,
          model_id as ModelIdType
        );
        const items = variants.map((v: Screen) => ({ id: v.id, screen_id: v.screenId }));
        return jsonResult({ variants: items, count: items.length, prompt });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 5. Get HTML
  server.registerTool(
    "stitch_get_html",
    {
      title: "Get Screen HTML Code",
      description:
        "Download the HTML/CSS code of a Stitch screen. Returns the raw HTML string that can be used as input to prototype-to-production skill or saved directly.",
      inputSchema: {
        project_id: ProjectIdSchema,
        screen_id: ScreenIdSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ project_id, screen_id }: { project_id: string; screen_id: string }) => {
      try {
        const project = stitchInstance.project(project_id);
        const screen = await project.getScreen(screen_id);
        const html = await screen.getHtml();
        return textResult(html);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 6. Get image
  server.registerTool(
    "stitch_get_image",
    {
      title: "Get Screen Screenshot",
      description:
        "Download a high-resolution screenshot of a Stitch screen. Returns an image URL or base64-encoded image. Use to preview a design before extracting code.",
      inputSchema: {
        project_id: ProjectIdSchema,
        screen_id: ScreenIdSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ project_id, screen_id }: { project_id: string; screen_id: string }) => {
      try {
        const project = stitchInstance.project(project_id);
        const screen = await project.getScreen(screen_id);
        const imageUrl = await screen.getImage();
        return textResult(imageUrl);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 7. Extract design context
  server.registerTool(
    "stitch_extract_design",
    {
      title: "Extract Design DNA",
      description:
        "Extract design tokens (fonts, colors, spacing, layout patterns) from a Stitch screen. Use the output to generate a DESIGN.md file for persistent design system awareness, or feed into the design-system-tokens skill to map values to your project's token hierarchy.",
      inputSchema: {
        project_id: ProjectIdSchema,
        screen_id: ScreenIdSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ project_id, screen_id }: { project_id: string; screen_id: string }) => {
      try {
        const result = await stitchInstance.callTool("extract_design_context", {
          projectId: project_id,
          screenId: screen_id,
        });
        return jsonResult(result as Record<string, unknown>);
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
