import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

const backend = process.env.GROS_BACKEND_ROOT;
if (!backend || !existsSync(join(backend, "tests/setup.js"))) {
  throw new Error("Set GROS_BACKEND_ROOT to an installed integrated Gros backend checkout.");
}
const root = resolve(backend);
const config = {
  rootDir: process.cwd(),
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/contracts/*.test.cjs"],
  globalSetup: join(root, "tests/setup.js"),
  globalTeardown: join(root, "tests/teardown.js"),
  testTimeout: 30000,
  transform: {},
};
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/jest/bin/jest.js"),
    "--config",
    JSON.stringify(config),
    "--runInBand",
    "--forceExit",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, GROS_BACKEND_ROOT: root },
  },
);
process.exitCode = result.status ?? 1;
