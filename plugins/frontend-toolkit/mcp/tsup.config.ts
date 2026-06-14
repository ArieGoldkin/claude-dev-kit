import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["stitch-server.ts"],
  format: ["esm"],
  outDir: "dist",
  splitting: false,
  platform: "node",
  target: "node20",
  noExternal: [/.*/],
});
