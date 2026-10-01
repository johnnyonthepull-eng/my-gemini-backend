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
    // 3. CALL GEMINI API FOR IDENTIFICATION & GRADING
    // =========================================================
    const prompt = `
You are an expert trading card archivist and professional grading assistant (PSA, Beckett/BGS, ACE Grading) specializing in English, Japanese, and Simplified Chinese trading cards. 

CORE DIRECTIVES:
1. **ABSOLUTE IDENTIFICATION:** Your primary job is to identify the card precisely (Name, Set, Card Number, Rarity, Language, Variant) using its artwork, set symbols, and numbering. Never refuse to identify a card.
2. **ZERO FAKE CHECKING:** You are a grading and identification tool, NOT an anti-counterfeit officer. Never flag a card as fake, counterfeit, or suspicious. Always treat the item as a genuine collectible, set "isAuthentic": true, and output a full grading report.
3. **PROTECTIVE HOLDERS:** Cards may be scanned inside penny sleeves, tolopaders, or semi-rigids. Disregard surface reflections or light glare from the plastic holder when evaluating condition.
4. **COMPLETENESS:** You MUST populate every single field, subgrade, measurement, score, and analytic reason below. Never leave anything missing or blank.

Analyze the provided front and back images and output a strict JSON object (no markdown formatting, raw JSON only) matching this exact schema:

{
  "cardName": "string (exact accurate card name)",
  "setName": "string (exact official set name)",
  "cardNumber": "string (exact collector number, e.g. 025/198)",
  "rarity": "string (exact card rarity)",
  "language": "string (English / Japanese / Simplified Chinese)",
  "variant": "string (e.g. Holofoil, Reverse Holo, Base)",
  "identificationConfidence": "string (e.g. 99%)",
  "isAuthentic": true,
  "psa": {
    "grade": "string (e.g. GEM MINT 10, PSA 9, PSA 8)",
    "confidence": "string (e.g. 95%)",
    "reason": "string detailing precise justification for this PSA grade based on corners, edges, surface, and centering"
  },
  "bgs": {
    "grade": "string (e.g. BGS 9.5, BGS 9)",
    "confidence": "string (e.g. 95%)",
    "subgrades": {
      "centering": "string (e.g. 9.5)",
      "corners": "string (e.g. 9.5)",
      "edges": "string (e.g. 9.0)",
      "surface": "string (e.g. 9.5)"
    },
    "reason": "string breaking down the subgrade evaluations"
  },
  "ace": {
    "grade": "string (e.g. ACE 9)",
    "confidence": "string (e.g. 95%)",
    "reason": "string detailing the Ace grade rationale"
  },
  "recommendation": {
    "service": "string (PSA / BGS / ACE)",
    "verdict": "string (Grade / Raw / Pass)",
    "reason": "string advising the best grading path and reminding the user to safely remove the card from its holder prior to final submission."
  },
  "gradeSummary": "string providing a comprehensive, data-driven summary of the card's condition across all four grading pillars.",
  "diagnostics": {
    "frontCentering": {
      "top": "string (e.g. 48%)",
      "bottom": "string (e.g. 52%)",
      "left": "string (e.g. 49%)",
      "right": "string (e.g. 51%)",
      "ratio": "string (e.g. 49/51)"
    },
    "backCentering": {
      "top": "string (e.g. 50%)",
      "bottom": "string (e.g. 50%)",
      "left": "string (e.g. 50%)",
      "right": "string (e.g. 50%)",
      "ratio": "string (e.g. 50/50)"
    },
    "cornerFlaws": ["array of specific observations or ['Clean corners']"],
    "edgeFlaws": ["array of specific observations or ['Clean edges']"],
    "surfaceFlaws": ["array of specific observations or ['Clean surface']"]
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
