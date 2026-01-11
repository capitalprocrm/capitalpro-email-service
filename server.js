import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

/* ======================
   BASIC CONFIG
====================== */
const PORT = process.env.PORT || 8080;

/* ======================
   SECURITY
====================== */
const EMAIL_API_KEY = process.env.EMAIL_API_KEY;

/* ======================
   GMAIL CONFIG
====================== */
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER;

/* ======================
   VALIDATION (STARTUP)
====================== */
if (!EMAIL_API_KEY) {
  console.error("❌ EMAIL_API_KEY missing");
}
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("❌ Gmail credentials missing");
}

/* ======================
   MIDDLEWARE
====================== */
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* ======================
   AUTH MIDDLEWARE
====================== */
app.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!EMAIL_API_KEY) {
    return res.status(500).json({
      error: "Server misconfigured",
      detail: "EMAIL_API_KEY not loaded",
    });
  }

  if (!apiKey || apiKey !== EMAIL_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  next();
});

/* ======================
   EMAIL TRANSPORT
====================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

/* ======================
   ROUTES
====================== */
app.post("/send-email", async (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: "Missing email fields" });
  }

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Email error:", err);
    res.status(500).json({
      error: "Email send failed",
      detail: err.message,
    });
  }
});

/* ======================
   START SERVER
====================== */
app.listen(PORT, () => {
  console.log(`📧 Email service listening on :${PORT}`);
});
