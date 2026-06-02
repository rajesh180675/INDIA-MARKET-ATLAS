/**
 * MoSPI build orchestrator
 * Runs all fetch scripts in sequence, respects rate limits.
 */

const path = require("path");
const { execSync } = require("child_process");

const FETCH_DIR = path.resolve(__dirname, "../fetch");
const FETCH_SCRIPTS = [
  "wpi.cjs",
  "asuse.cjs",
  "mnre.cjs",
  "nas-pdf.cjs",
];

function runScript(name) {
  const scriptPath = path.join(FETCH_DIR, name);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log("=".repeat(60));

  try {
    const result = execSync(`node "${scriptPath}"`, {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
    });
    return { ok: true, output: result };
  } catch (err) {
    console.error(`FAILED: ${name} — ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function main() {
  console.log("MoSPI Build All — starting at " + new Date().toISOString());

  const results = [];
  for (const script of FETCH_SCRIPTS) {
    results.push({ script, ...runScript(script) });
  }

  console.log("\n" + "=".repeat(60));
  console.log("Build Summary");
  console.log("=".repeat(60));

  let failures = 0;
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    console.log(`  ${status}: ${r.script}`);
    if (!r.ok) failures++;
  }

  console.log(`\nTotal: ${results.length} scripts, ${failures} failures`);

  if (failures > 0) {
    console.error("\nOne or more fetch scripts failed. Check output above.");
    process.exit(1);
  }

  console.log("\nAll scripts completed successfully.");
}

if (require.main === module) {
  main();
}

module.exports = { main, runScript };
