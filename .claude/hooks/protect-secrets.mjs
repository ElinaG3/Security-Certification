// PreToolUse hook: blocks Claude from reading, editing, or printing secret files.
// Claude Code sends the planned tool call as JSON on stdin.
// Exit code 2 = BLOCK the action; whatever we write to stderr is shown to Claude as the reason.

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // can't parse -> don't interfere
  }

  const tool = input.tool_name;
  const args = input.tool_input || {};

  // Matches .env, .env.local, .env.production, etc. Allows .env.example (no secrets in it).
  const secretFile = /(^|[\/\\])\.env(?!\.example)(\.[\w-]+)?$/;

  if (["Read", "Edit", "Write"].includes(tool)) {
    const path = args.file_path || "";
    if (secretFile.test(path)) {
      console.error(
        `Blocked: ${path} holds secrets. Ask Elina for the variable NAME you need instead of reading the file.`
      );
      process.exit(2);
    }
  }

  if (tool === "Bash") {
    const cmd = args.command || "";
    const touchesEnv = /\.env(?!\.example)\b/.test(cmd);
    const dumpsEnv = /\b(printenv|env\s*$|echo\s+\$\w*(DATABASE|SECRET|KEY|TOKEN))/i.test(cmd);
    const pastesDbUrl = /postgres(ql)?:\/\/[^\s]+:[^\s]+@/i.test(cmd);
    if (touchesEnv || dumpsEnv || pastesDbUrl) {
      console.error(
        "Blocked: this command would expose secrets (env file, env dump, or a connection string). Find another way or ask Elina."
      );
      process.exit(2);
    }
  }

  process.exit(0); // everything else is allowed
});
