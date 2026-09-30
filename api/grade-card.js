import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ error: "Server Error: GEMINI_API_KEY is missing in Vercel settings." });
    }

    const body = req.body || {};
    const frontImage = body.frontImage || body.frontBase64;
    const backImage = body.backImage || body.backBase64;

    if (!frontImage || !backImage) {
      return res.status(200).json({ error: "Missing front or back image payload." });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Using the current active model identifier
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Analyze card images and provide strict grading assessment." },
            { inlineData: { mimeType: "image/jpeg", data: frontImage.replace(/^data:.+?;base64,/, "") } },
            { inlineData: { mimeType: "image/jpeg", data: backImage.replace(/^data:.+?;base64,/, "") } }
          ]
        }
      ]
    });

    let text = response.text ? response.text.trim() : "";
    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "").trim();
    }

    return res.status(200).json(JSON.parse(text));

  } catch (error) {
    console.error("API Route Error:", error);
    return res.status(200).json({ error: "Gemini Processing Error: " + (error?.message || String(error)) });
  }
}
