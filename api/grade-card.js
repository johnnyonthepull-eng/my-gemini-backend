import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Allow CORS
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
      return res.status(500).json({ error: "API key missing on server." });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Super simple text call to test connectivity
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Say hello and confirm connection."
    });

    return res.status(200).json({ 
      success: true, 
      message: response.text || "Connected successfully!" 
    });

  } catch (error) {
    console.error("Minimal test error:", error);
    return res.status(500).json({ error: error.message });
  }
}
