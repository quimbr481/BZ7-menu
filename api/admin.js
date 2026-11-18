import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const STORE_KEY = "bz7:keys:v1";
const ADMIN_PASS = "@Bahiano100418@Is";

function computeDurationMs(preset, customAmount, customUnit) {
  const map = {
    "1h": 3600 * 1000,
    "1d": 86400 * 1000,
    "7d": 7 * 86400 * 1000,
    "30d": 30 * 86400 * 1000,
    "365d": 365 * 86400 * 1000,
    "perm": null
  };
  if (preset !== "custom") return map[preset] ?? null;

  const qty = Math.max(1, Number(customAmount) || 1);
  if (customUnit === "minutes") return qty * 60 * 1000;
  if (customUnit === "hours") return qty * 3600 * 1000;
  return qty * 86400 * 1000;
}

function generateKeyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `BZ7-${block()}-${block()}-${block()}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") return res.status(200).end();

  const pass = req.headers["x-admin-password"];
  if (pass !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, message: "Senha incorreta!" });
  }

  const { action, key, description, preset, customAmount, customUnit } = req.body || {};
  const db = (await redis.get(STORE_KEY)) || {};

  if (action === "list") {
    return res.status(200).json({ ok: true, keys: Object.values(db) });
  }

  if (action === "create") {
    const newKey = generateKeyCode();
    const durationMs = computeDurationMs(preset, customAmount, customUnit);
    const now = Date.now();
    db[newKey] = {
      key: newKey,
      description: String(description || "Sem descricao").trim(),
      preset,
      durationMs,
      createdAt: now,
      expiresAt: durationMs ? now + durationMs : null,
      hwid: null,
      lastIp: null,
      lastDevice: null,
      lastUser: null,
      lastLoginAt: null,
      logins: 0
    };
    await redis.set(STORE_KEY, db);
    return res.status(200).json({ ok: true, created: db[newKey] });
  }

  if (!key || !db[key]) {
    return res.status(404).json({ ok: false, message: "Key nao encontrada." });
  }

  if (action === "reset_hwid") {
    db[key].hwid = null;
    await redis.set(STORE_KEY, db);
    return res.status(200).json({ ok: true });
  }

  if (action === "restart_key") {
    const now = Date.now();
    db[key].hwid = null;
    db[key].expiresAt = db[key].durationMs ? now + db[key].durationMs : null;
    await redis.set(STORE_KEY, db);
    return res.status(200).json({ ok: true });
  }

  if (action === "change_duration") {
    const durationMs = computeDurationMs(preset, customAmount, customUnit);
    const now = Date.now();
    db[key].preset = preset;
    db[key].durationMs = durationMs;
    db[key].expiresAt = durationMs ? now + durationMs : null;
    await redis.set(STORE_KEY, db);
    return res.status(200).json({ ok: true });
  }

  if (action === "edit_description") {
    db[key].description = String(description || "").trim();
    await redis.set(STORE_KEY, db);
    return res.status(200).json({ ok: true });
  }

  if (action === "delete") {
    delete db[key];
    await redis.set(STORE_KEY, db);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ ok: false, message: "Acao invalida." });
}