import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { playwright } from "@vitest/browser-playwright";

// Real Chromium DOM, mocked identity/API boundaries. No production services.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/components/auth-provider.test.tsx",
      "src/routes/-login.test.tsx",
      "src/routes/-change-password.test.tsx",
      "src/routes/-_pos.scanner.test.tsx",
      "src/routes/-_pos.checkout.test.tsx",
      "src/routes/-_pos.success.test.tsx",
      "src/routes/-_pos.orders.test.tsx",
      "src/lib/cart-context.test.tsx",
    ],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
