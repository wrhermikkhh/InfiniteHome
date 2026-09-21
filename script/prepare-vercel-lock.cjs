const fs = require("node:fs");

const path = "package-lock.json";
const internalPrefix = "http://package-firewall.replit.internal/npm/";
const publicPrefix = "https://registry.npmjs.org/";
const original = fs.readFileSync(path, "utf8");
const normalized = original.replaceAll(internalPrefix, publicPrefix);

if (normalized.includes("package-firewall.replit.internal")) {
  throw new Error("Unsupported internal package URL remains in package-lock.json");
}

fs.writeFileSync(path, normalized);