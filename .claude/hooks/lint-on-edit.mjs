// PostToolUse hook: after Claude edits a .ts/.tsx/.js/.jsx file, run ESLint on JUST that file.
// If there are errors, exit 2 so Claude sees them and fixes them immediately.

import { execSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const file = input?.tool_input?.file_path || "";
  if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) process.exit(0); // only code files
  if (file.includes("node_modules") || file.includes(".claude")) process.exit(0);

  try {
    execSync(`npx eslint --fix "${file}"`, { stdio: "pipe" });
    process.exit(0); // clean (or auto-fixed)
  } catch (err) {
    const out = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    console.error(`ESLint found problems in ${file}. Fix them before continuing:\n${out.slice(0, 3000)}`);
    process.exit(2);
  }
});
