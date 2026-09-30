import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // 1. Force CORS headers on every single response
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 2. Handle browser preflight OPTIONS request immediately
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable on Vercel." });
    }

    const body = req.body || {};
    const frontImage = body.frontImage || body.frontBase64;
    const backImage = body.backImage || body.backBase64;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing front or back image data." });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Quick test generation using the active model
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Confirming connection for grading backend."
    });

    return res.status(200).json({ 
      success: true, 
      message: response.text || "Connected!" 
    });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
}
