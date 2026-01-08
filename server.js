import express from "express";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8080;

// SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Send email endpoint
app.post("/send-email", async (req, res) => {
  try {
    const {
      to,
      subject,
      html,
      fromName,
      replyTo,
      attachments,
    } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await transporter.sendMail({
      from: `"${fromName || "CapitalPro CRM"}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
      replyTo,
      attachments,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Email send failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Email service running on :${PORT}`);
});
