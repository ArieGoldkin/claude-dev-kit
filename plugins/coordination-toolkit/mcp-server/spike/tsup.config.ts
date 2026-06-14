import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Bundle all dependencies into a single file (no node_modules needed at runtime)
  noExternal: [/.*/],
  banner: { js: "#!/usr/bin/env node" },
});
