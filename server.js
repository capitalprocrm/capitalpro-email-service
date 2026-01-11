import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

/* =========================
   BASIC CONFIG
========================= */
const PORT = process.env.PORT || 8080;

/* =========================
   SECURITY (API KEY)
========================= */
const EMAIL_API_KEY = process.env.EMAIL_API_KEY || "";

/* =========================
   GMAIL CONFIG (ENV VARS)
========================= */
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER;

/* =========================
   VALIDATION CHECK
========================= */
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("❌ Missing GMAIL_USER or GMAIL_APP_PASSWORD");
}

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: "*",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  })
);

/* =========================
   API KEY GUARD
========================= */
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const apiKey = req.headers["x-api-key"];

  if (!EMAIL_API_KEY || apiKey !== EMAIL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

/* =========================
   EMAIL TRANSPORT
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

/* =========================
   SEND EMAIL ENDPOINT
========================= */
app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Email send error:", err);
    res.status(500).json({
      error: "Email send failed",
      detail: err.message,
    });
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("CapitalPro Email Service is running");
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Email service listening on port ${PORT}`);
});
