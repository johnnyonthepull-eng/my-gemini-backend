const { GoogleGenAI } = require("@google/genai");

module.exports = async function handler(req, res) {
  // =========================================================
  // 1. BULLETPROOF CORS HEADERS
  // =========================================================
  const allowedOrigin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing on Vercel.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { frontImage, backImage, sessionNonce } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Both frontImage and backImage are required." });
    }

    console.log("OTPTCG grading request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
You are a master trading card grading inspector. Analyze the provided front and back card images. 
Return a strict raw JSON object (no markdown formatting, no code blocks, just raw JSON) matching this exact schema precisely. Do not leave any fields blank or use dashes.

{
  "cardName": "string",
  "setName": "string",
  "cardNumber": "string",
  "rarity": "string",
  "language": "string",
  "variant": "string",
  "identificationConfidence": "string",
  "isAuthentic": true,
  "psaGrade": "string",
  "psaConfidence": "string",
  "psaReason": "string",
  "bgsGrade": "string",
  "bgsConfidence": "string",
  "bgsCenteringSub": "string",
  "bgsCornersSub": "string",
  "bgsEdgesSub": "string",
  "bgsSurfaceSub": "string",
  "bgsReason": "string",
  "aceGrade": "string",
  "aceConfidence": "string",
  "aceReason": "string",
  "recommendationService": "string",
  "recommendationVerdict": "string",
  "recommendationReason": "string",
  "gradeSummary": "string",
  "diagnostics": {
    "frontCentering": {
      "top": "string",
      "bottom": "string",
      "left": "string",
      "right": "string",
      "ratio": "string"
    },
    "backCentering": {
      "top": "string",
      "bottom": "string",
      "left": "string",
      "right": "string",
      "ratio": "string"
    },
    "cornerFlaws": ["array of detailed descriptions"],
    "edgeFlaws": ["array of detailed descriptions"],
    "surfaceFlaws": ["array of detailed descriptions"]
  }
}
`;

    // Using the stable auto-updating Flash alias supported by @google/genai
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: cleanFront } },
            { inlineData: { mimeType: "image/jpeg", data: cleanBack } }
          ]
        }
      ]
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("No response received from the grading model.");
    }

    const cleanedJSON = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsedResult = JSON.parse(cleanedJSON);
    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("OTPTCG grade-card error:", error);
    return res.status(500).json({ error: error.message || "Card grading failed." });
  }
};
