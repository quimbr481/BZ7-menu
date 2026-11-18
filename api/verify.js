import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const STORE_KEY = "bz7:keys:v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const body = req.method === "POST" ? (req.body || {}) : (req.query || {});
  const key = String(body.key || "").trim();
  const hwid = String(body.hwid || "").trim();
  const device = String(body.device || "PC").trim();
  const username = String(body.username || "Desconhecido").trim();

  if (!key || !hwid) {
    return res.status(400).json({ valid: false, message: "Key ou HWID ausente." });
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0].trim() : (req.socket?.remoteAddress || "Desconhecido");

  const db = (await redis.get(STORE_KEY)) || {};
  const record = db[key];

  if (!record) {
    return res.status(200).json({ valid: false, message: "Key inexistente ou revogada!" });
  }

  if (record.expiresAt && Date.now() > record.expiresAt) {
    return res.status(200).json({ valid: false, message: "Esta Key expirou!" });
  }

  // Trava de HWID (Celular / PC)
  if (!record.hwid) {
    record.hwid = hwid;
  } else if (record.hwid !== hwid) {
    return res.status(200).json({
      valid: false,
      message: "HWID bloqueado! Esta Key pertence a outro dispositivo."
    });
  }

  record.lastIp = ip;
  record.lastDevice = device;
  record.lastUser = username;
  record.lastLoginAt = Date.now();
  record.logins = (record.logins || 0) + 1;

  db[key] = record;
  await redis.set(STORE_KEY, db);

  return res.status(200).json({
    valid: true,
    message: "Acesso autorizado!",
    expiresAt: record.expiresAt,
    description: record.description || ""
  });
}