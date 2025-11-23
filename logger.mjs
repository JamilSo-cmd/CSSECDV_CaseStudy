import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// ESM dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logsCollection = null;

// Append-only audit log file
const auditStream = fs.createWriteStream(path.join(__dirname, "audit.log"), {
  flags: "a"
});

// Hash helper
function sha256(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// Extract client IP safely without external dependencies
function getIP(req) {
  return (
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req?.ip ||
    req?.connection?.remoteAddress ||
    "unknown"
  );
}

// Convert a Date (UTC) to Singapore time (UTC+8)
function toSingaporeTime(date) {
  const sgOffsetMs = 8 * 60 * 60 * 1000; // UTC+8
  return new Date(date.getTime() + sgOffsetMs).toISOString().replace("Z", "+08:00");
}

// Initialize logger after MongoDB connects
export function initLogger(mongoClient) {
  logsCollection = mongoClient.db("ForumsDB").collection("Logs");
  console.log("[LOGGER] Logger initialized with SG time support");
}

// Main log function
export async function logEvent(req, level = "info", message = "", userId = null) {
  if (!logsCollection) {
    console.error("[LOGGER ERROR] initLogger() not called.");
    return;
  }

  try {
    // Get last log entry to chain hashes
    const last = await logsCollection
      .find({})
      .sort({ _id: -1 })   // strongest, safest ordering
      .limit(1)
      .toArray();

    const prevHash = last[0]?.hash || "";

    // Use real Date object for DB consistency
    const now = new Date();

    const entry = {
      timestamp: now,                   // stored as actual Date object
      localTime: toSingaporeTime(now),  // human-readable Singapore time
      level,
      message,
      userId,
      ip: getIP(req),
      route: req?.originalUrl || "system",
      prevHash
    };

    // Compute hash AFTER all fields prepared
    entry.hash = sha256(entry);

    // Insert into Mongo
    await logsCollection.insertOne(entry);

    // Append into audit log
    auditStream.write(JSON.stringify(entry) + "\n");

    // Console log for dev
    console.log(`[${level.toUpperCase()}] ${message}`);

  } catch (err) {
    console.error("[LOGGER INTERNAL ERROR]", err);
  }
}

export default { initLogger, logEvent };