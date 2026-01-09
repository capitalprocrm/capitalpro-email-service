import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

// ---- Config ----
const PORT = process.env.PORT || 8080;

// Simple API key protection (same key you store in Base44)
const API_KEY = process.env.API_KEY || "";

// Gmail App Password setup
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";

const FROM_NAME = process.env.FROM_NAME || "Capital Pro";
const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER;

// ---- Middleware ----
app.use(express.json({ limit: "2mb" }));

// CORS (lets Hoppscotch + Base44 call the API)
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);
app.options("*", cors());

// ---- Helpers ----
function requireApiKey(req, res) {
  if (!API_KEY) return true; // if not set, do not block (useful for early testing)
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    res.status(401).json({ error: "Unauthorized (missing/invalid x-api-key)" });
    return false;
  }
  return true;
}

function buildTransporter() {
  if (EMAIL_PROVIDER !== "gmail") {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${EMAIL_PROVIDER}`);
  }
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

// ---- Routes ----
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "capitalpro-email-service",
    time: new Date().toISOString(),
  });
});

// Send email
// POST /send-email
// Headers: x-api-key: <API_KEY> (if API_KEY env is set)
// Body: { to, subject, html, text?, replyTo?, cc?, bcc?, organizationId?, meta? }
app.post("/send-email", async (req, res) => {
  try {
    if (!requireApiKey(req, res)) return;

    const {
      to,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
      organizationId,
      meta,
    } = req.body || {};

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["to", "subject", "html OR text"],
      });
    }

    const transporter = buildTransporter();

    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
      replyTo: replyTo || undefined,
      cc: cc || undefined,
      bcc: bcc || undefined,
      // optional headers for tracking/tenant context
      headers: {
        ...(organizationId ? { "X-Organization-Id": String(organizationId) } : {}),
        ...(meta ? { "X-Meta": JSON.stringify(meta).slice(0, 900) } : {}),
      },
    };

    const info = await transporter.sendMail(mailOptions);

    return res.json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    });
  } catch (err) {
    console.error("send-email error:", err);
    return res.status(500).json({
      error: "Email send failed",
      detail: String(err?.message || err),
    });
  }
});

// Catch-all (helps when you open the domain in browser)
app.get("/", (req, res) => {
  res.send("CapitalPro Email Service is running. Use /health or POST /send-email");
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Email service listening on :${PORT}`);
});

