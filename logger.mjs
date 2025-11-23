// logger.mjs — dependency-free tamper-evident logger

import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// ESM dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logsCollection = null;

// Append-only audit file stream
const auditStream = fs.createWriteStream(path.join(__dirname, "audit.log"), {
  flags: "a"
});

// Hash helper
function sha256(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// Extract IP without external packages
function getIP(req) {
  return (
    req?.ip ||
    req?.headers?.["x-forwarded-for"] ||
    req?.connection?.remoteAddress ||
    "unknown"
  );
}

// Initialize logger AFTER MongoDB connects
export function initLogger(mongoClient) {
  logsCollection = mongoClient.db("ForumsDB").collection("Logs");
  console.log("[LOGGER] Initialized dependency-free logger");
}

// Main log function
export async function logEvent(req, level = "info", message = "", userId = null) {
  if (!logsCollection) {
    console.error("[LOGGER ERROR] initLogger() has not been called.");
    return;
  }

  try {
    // Get the last log to chain hashes
    const last = await logsCollection
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();

    const prevHash = last[0]?.hash || "";

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      userId,
      ip: getIP(req),
      route: req?.originalUrl || "system",
      prevHash
    };

    entry.hash = sha256(entry);

    // Write to DB
    await logsCollection.insertOne(entry);

    // Write to append-only file
    auditStream.write(JSON.stringify(entry) + "\n");

    console.log(`[${level.toUpperCase()}] ${message}`);
  } catch (err) {
    console.error("[LOGGER INTERNAL ERROR]", err);
  }
}

export default { initLogger, logEvent };
