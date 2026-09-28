/**
 * Builds the Navigate Wealth design system showcase (src/showcase) as a static
 * page for the website to embed at /design-system-library/. The starter kit's
 * own app (vite.config.ts, index.html) is left as Untitled UI ships it.
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { type Plugin, defineConfig } from "vite";

const BASE = "/design-system-library/";
// Straight into the website's build output, next to the site itself.
const OUT_DIR = path.resolve(__dirname, "../../dist/design-system-library");

/** Serve the page as the folder's index.html once the build is written. */
const renameEntry = (): Plugin => ({
    name: "nw-showcase-index",
    apply: "build",
    closeBundle() {
        const from = path.join(OUT_DIR, "showcase.html");
        if (fs.existsSync(from)) fs.renameSync(from, path.join(OUT_DIR, "index.html"));
    },
});

export default defineConfig({
    base: BASE,
    plugins: [react(), tailwindcss(), renameEntry()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        open: "/design-system-library/showcase.html",
    },
    build: {
        outDir: OUT_DIR,
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, "showcase.html"),
        },
    },
});
