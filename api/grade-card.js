import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // =========================================================
  // 1. ROBUST CORS & PREFLIGHT HANDLING
  // =========================================================
  const allowedOrigin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  
  const requestedHeaders = req.headers["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers", 
    requestedHeaders || "Content-Type, Accept, Cache-Control, Pragma, Expires, X-Requested-With"
  );
  
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // =========================================================
    // 2. PARSE REQUEST PAYLOAD
    // =========================================================
    const { frontImage, backImage, sessionNonce } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({
        error: "Both frontImage and backImage are required."
      });
    }

    console.log("OTPTCG grading request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    // =========================================================
    // 3. CALL GEMINI API FOR CARD ANALYSIS & GRADING
    // =========================================================
    const prompt = `
You are an expert trading card authenticator and professional grader specializing in Pokémon and trading cards (PSA, Beckett/BGS, ACE Grading) across English, Japanese, and Simplified Chinese sets. 

CRITICAL INSTRUCTION: Assume the card is authentic unless there are glaring, undeniable counterfeit flaws (e.g., completely wrong back artwork, incorrect game title, or missing official copyright text). Do NOT flag regional print differences (such as Japanese texture layouts, Simplified Chinese back coloring, or standard border variations) as fakes. 

Analyze the provided front and back images of the trading card and output a strict JSON object (no markdown formatting, raw JSON only) matching this exact schema:

{
  "cardName": "string",
  "setName": "string",
  "cardNumber": "string",
  "rarity": "string",
  "language": "string",
  "variant": "string",
  "identificationConfidence": "string (e.g. 98%)",
  "isAuthentic": true,
  "psa": {
    "grade": "string (e.g. 9 or GEM MINT 10)",
    "confidence": "string",
    "reason": "string"
  },
  "bgs": {
    "grade": "string",
    "confidence": "string",
    "subgrades": {
      "centering": "string",
      "corners": "string",
      "edges": "string",
      "surface": "string"
    },
    "reason": "string"
  },
  "ace": {
    "grade": "string",
    "confidence": "string",
    "reason": "string"
  },
  "recommendation": {
    "service": "string (e.g. PSA / BGS / ACE)",
    "verdict": "string (e.g. Grade / Raw / Pass)",
    "reason": "string"
  },
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
    "cornerFlaws": ["array of strings describing corner issues or empty"],
    "edgeFlaws": ["array of strings describing edge issues or empty"],
    "surfaceFlaws": ["array of strings describing surface issues or empty"]
  }
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanFront
              }
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBack
              }
            }
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

    // =========================================================
    // 4. RETURN SUCCESS RESPONSE
    // =========================================================
    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("OTPTCG grade-card error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
