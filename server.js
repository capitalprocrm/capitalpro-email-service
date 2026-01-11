import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

/**
 * =========================
 * BASIC CONFIG
 * =========================
 */
const PORT = process.env.PORT || 8080;

// API key your Base44/Hoppscotch will send in header: x-api-key
const EMAIL_API_KEY = (process.env.EMAIL_API_KEY || "").trim();

/**
 * =========================
 * GMAIL CONFIG (ENV VARS)
 * =========================
 */
const GMAIL_USER = (process.env.GMAIL_USER || "").trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").trim();

/**
 * =========================
 * OPTIONAL SMTP CONFIG
 * If SMTP_HOST is present, we use SMTP instead of Gmail transport.
 * =========================
 */
const SMTP_HOST = (process.env.SMTP_HOST || "").trim();
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = (process.env.SMTP_USER || "").trim();
const SMTP_PASS = (process.env.SMTP_PASS || "").trim();
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "")
    .trim()
    .toLowerCase() === "true";

/**
 * =========================
 * FROM CONFIG
 * =========================
 */
const FROM_NAME = (process.env.FROM_NAME || "Capital Pro").trim();
const FROM_EMAIL = (process.env.FROM_EMAIL || GMAIL_USER || SMTP_USER || "").trim();

/**
 * =========================
 * MIDDLEWARE
 * =========================
 */
app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  })
);

// Preflight support
app.options("*", cors());

/**
 * =========================
 * AUTH (API KEY)
 * =========================
 */
function requireApiKey(req, res, next) {
  // Safe header lookup (case-insensitive)
  const sentKey = (req.get("x-api-key") || "").trim();

  // If you want to temporarily disable auth, comment this whole function out
  // and remove `requireApiKey` from the route below.
  if (!EMAIL_API_KEY) {
    return res.status(500).json({
      error: "Server misconfigured",
      detail: "Missing EMAIL_API_KEY env var in Railway",
    });
  }

  if (!sentKey) {
    return res.status(401).json({
      error: "Unauthorized",
      detail: "Missing x-api-key header",
    });
  }

  if (sentKey !== EMAIL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

/**
 * =========================
 * HEALTH
 * =========================
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "capitalpro-email-service",
    hasEmailApiKey: !!EMAIL_API_KEY,
    hasFromEmail: !!FROM_EMAIL,
    usingSmtp: !!SMTP_HOST,
    hasGmailUser: !!GMAIL_USER,
  });
});

/**
 * =========================
 * CREATE TRANSPORT
 * - If SMTP_HOST exists => SMTP
 * - Else => Gmail App Password
 * =========================
 */
function createTransport() {
  if (SMTP_HOST) {
    // SMTP mode
    if (!SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      throw new Error(
        "Missing SMTP env vars. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optional SMTP_SECURE)"
      );
    }

    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // true for 465, false for 587
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  // Gmail mode
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD env var");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * =========================
 * SEND EMAIL
 * Body JSON:
 * {
 *   "to": "someone@email.com",
 *   "subject": "Hello",
 *   "text": "Plain text message",
 *   "html": "<b>Optional HTML</b>"
 * }
 * =========================
 */
app.post("/send-email", requireApiKey, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};

    if (!FROM_EMAIL) {
      return res.status(500).json({
        error: "Email send failed",
        detail: "Missing FROM_EMAIL (set FROM_EMAIL in Railway, or ensure GMAIL_USER/SMTP_USER exists)",
      });
    }

    if (!to || typeof to !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'to' field" });
    }
    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'subject' field" });
    }

    const transport = createTransport();

    // Optional: quick verify (helps catch bad creds fast)
    // await transport.verify();

    const info = await transport.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      text: typeof text === "string" ? text : undefined,
      html: typeof html === "string" ? html : undefined,
    });

    return res.status(200).json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (err) {
    const message = err?.message || String(err);

    console.error("❌ Email send failed:", message);

    // Return the exact “missing env var” message so you can fix Railway quickly
    return res.status(500).json({
      error: "Email send failed",
      detail: message,
    });
  }
});

/**
 * =========================
 * START
 * =========================
 */
app.listen(PORT, () => {
  console.log(`Email service listening on :${PORT}`);
});
