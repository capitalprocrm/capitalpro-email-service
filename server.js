import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

/* =========================
   BASIC CONFIG
========================= */
const PORT = process.env.PORT || 8080;

/**
 * Auth options (workaround):
 * - Set DISABLE_AUTH=true in Railway to bypass API key checks temporarily.
 * - Otherwise requires a key via env: EMAIL_API_KEY or API_KEY
 */
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "false").toLowerCase() === "true";

// Accept either name (this fixes “wrong env var name” problems)
const EMAIL_API_KEY = process.env.EMAIL_API_KEY || process.env.API_KEY || "";

/* =========================
   EMAIL CONFIG (GMAIL)
========================= */
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER;

/* =========================
   STARTUP DIAGNOSTICS
========================= */
console.log("=== CapitalPro Email Service starting ===");
console.log("PORT:", PORT);
console.log("DISABLE_AUTH:", DISABLE_AUTH);
console.log("EMAIL_API_KEY loaded:", Boolean(EMAIL_API_KEY));
console.log("GMAIL_USER loaded:", Boolean(GMAIL_USER));
console.log("GMAIL_APP_PASSWORD loaded:", Boolean(GMAIL_APP_PASSWORD));
console.log("FROM_EMAIL:", FROM_EMAIL || "(empty)");
console.log("=======================================");

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* =========================
   HEALTH CHECK (IMPORTANT)
   Use this to confirm Railway env vars are actually loaded
========================= */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    auth: {
      DISABLE_AUTH,
      EMAIL_API_KEY_loaded: Boolean(EMAIL_API_KEY),
      // show length only (never leak the secret)
      EMAIL_API_KEY_length: EMAIL_API_KEY ? EMAIL_API_KEY.length : 0,
    },
    gmail: {
      GMAIL_USER_loaded: Boolean(GMAIL_USER),
      GMAIL_APP_PASSWORD_loaded: Boolean(GMAIL_APP_PASSWORD),
      FROM_EMAIL_loaded: Boolean(FROM_EMAIL),
    },
  });
});

/* =========================
   AUTH CHECK
========================= */
function getProvidedKey(req) {
  // Hoppscotch header: x-api-key
  const headerKey = req.headers["x-api-key"] || req.headers["X-Api-Key"];
  if (headerKey) return String(headerKey).trim();

  // Optional: support Authorization: Bearer <key>
  const auth = req.headers["authorization"];
  if (auth && typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  // Optional: query fallback for testing: /send-email?key=...
  if (req.query?.key) return String(req.query.key).trim();

  return "";
}

function requireApiKey(req, res, next) {
  if (DISABLE_AUTH) return next();

  if (!EMAIL_API_KEY) {
    return res.status(500).json({
      error: "Server misconfigured",
      detail: "EMAIL_API_KEY (or API_KEY) not loaded in Railway runtime env",
    });
  }

  const provided = getProvidedKey(req);
  if (!provided || provided !== EMAIL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

/* =========================
   SEND EMAIL ROUTE
========================= */
app.post("/send-email", requireApiKey, async (req, res) => {
  try {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return res.status(500).json({
        error: "Email send failed",
        detail: "Missing GMAIL_USER or GMAIL_APP_PASSWORD env var",
      });
    }

    const { to, subject, text, html } = req.body || {};

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        error: "Bad request",
        detail: "Required: to, subject, and text or html",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    return res.json({
      ok: true,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({
      error: "Email send failed",
      detail: err?.message || String(err),
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Email service listening on :${PORT}`);
});
