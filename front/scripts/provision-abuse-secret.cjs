// Run on the app host. Never print the generated secret.
const fs = require("node:fs");
const crypto = require("node:crypto");
const file = ".env";
const content = fs.readFileSync(file, "utf8");
const configured = require("dotenv").parse(content).ABUSE_HMAC_SECRET;
if (configured && configured.length < 32) throw new Error("Configured abuse secret is too short");
if (!configured) fs.appendFileSync(file, "\nABUSE_HMAC_SECRET=" + crypto.randomBytes(32).toString("hex") + "\n", { mode: 0o600 });
if (process.platform !== "win32") fs.chmodSync(file, 0o600);
console.log("Abuse identification secret configured.");
