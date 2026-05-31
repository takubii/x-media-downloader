import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const inputPath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rolldownOptions: {
      input: {
        background: inputPath("src/background/service-worker.ts"),
        content: inputPath("src/content/content.ts"),
        options: inputPath("src/options/options.html"),
        offscreen: inputPath("src/offscreen/offscreen.html"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "content") return "content.js";
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
