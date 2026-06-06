import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// jsdom 27's transitive dep (@asamuzakjp/css-color) CJS-requires an ESM
// module, which throws on Node < 20.19. Enabling require(ESM) lets the test
// worker load jsdom. Propagated to spawned workers via NODE_OPTIONS.
const requireModuleFlag = "--experimental-require-module";
if (!(process.env.NODE_OPTIONS ?? "").includes(requireModuleFlag)) {
  process.env.NODE_OPTIONS =
    `${process.env.NODE_OPTIONS ?? ""} ${requireModuleFlag}`.trim();
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
