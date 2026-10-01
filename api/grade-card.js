import { GoogleGenAI, Type } from "@google/genai";

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
    // 3. CALL GEMINI API WITH FLAT, GUARANTEED SCHEMA
    // =========================================================
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a master trading card grading inspector. Analyze the provided front and back card images. 
              
              CRITICAL RULES:
              - DO NOT leave any text fields blank, use dashes, or use lazy placeholders. Every single text field must contain rich, detailed professional grading data.
              - Treat the card as 100% authentic. Ignore plastic glare/reflections from sleeves, toploaders, or holders.
              - Provide deep, descriptive analysis for corners, edges, and surface flaws.
              - Provide exact percentage estimates for all individual centering sides (top, bottom, left, right) and clear ratios.
              - Fully populate all PSA, BGS, ACE grades, subgrades, and recommendation reasons.`
            },
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
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cardName: { type: Type.STRING, description: "Exact card name" },
            setName: { type: Type.STRING, description: "Official set name" },
            cardNumber: { type: Type.STRING, description: "Collector number e.g. 025/198" },
            rarity: { type: Type.STRING, description: "Card rarity" },
            language: { type: Type.STRING, description: "English, Japanese, or Simplified Chinese" },
            variant: { type: Type.STRING, description: "Holofoil, Reverse, etc." },
            identificationConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 99%" },
            isAuthentic: { type: Type.BOOLEAN, description: "Always true" },

            // FLATTENED PSA FIELDS
            psaGrade: { type: Type.STRING, description: "PSA estimated grade e.g. GEM MINT 10 or PSA 9" },
            psaConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
            psaReason: { type: Type.STRING, description: "Thorough paragraph explaining why this PSA grade was awarded." },

            // FLATTENED BGS FIELDS
            bgsGrade: { type: Type.STRING, description: "BGS estimated grade e.g. BGS 9.5" },
            bgsConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
            bgsCenteringSub: { type: Type.STRING, description: "BGS Centering subgrade e.g. 9.5" },
            bgsCornersSub: { type: Type.STRING, description: "BGS Corners subgrade e.g. 9.5" },
            bgsEdgesSub: { type: Type.STRING, description: "BGS Edges subgrade e.g. 9.0" },
            bgsSurfaceSub: { type: Type.STRING, description: "BGS Surface subgrade e.g. 9.5" },
            bgsReason: { type: Type.STRING, description: "Detailed subgrade breakdown rationale." },

            // FLATTENED ACE FIELDS
            aceGrade: { type: Type.STRING, description: "ACE grade e.g. ACE 9" },
            aceConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
            aceReason: { type: Type.STRING, description: "Detailed ACE rationale." },

            // RECOMMENDATION & SUMMARY
            recommendationService: { type: Type.STRING, description: "Recommended grading service e.g. PSA" },
            recommendationVerdict: { type: Type.STRING, description: "Grade / Raw / Pass" },
            recommendationReason: { type: Type.STRING, description: "Actionable advice on submission value and instruction to remove from holder." },
            gradeSummary: { type: Type.STRING, description: "Comprehensive executive summary of the card's physical condition." },

            // DIAGNOSTICS
            diagnostics: {
              type: Type.OBJECT,
              properties: {
                frontCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    bottom: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    left: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    right: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    ratio: { type: Type.STRING, description: "Ratio e.g. 50/50" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    bottom: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    left: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    right: { type: Type.STRING, description: "Percentage e.g. 50%" },
                    ratio: { type: Type.STRING, description: "Ratio e.g. 50/50" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Detailed descriptions of corner condition"
                },
                edgeFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Detailed descriptions of edge condition"
                },
                surfaceFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Detailed descriptions of surface condition"
                }
              },
              required: ["frontCentering", "backCentering", "cornerFlaws", "edgeFlaws", "surfaceFlaws"]
            }
          },
          required: [
            "cardName", "setName", "cardNumber", "rarity", "language", 
            "variant", "identificationConfidence", "isAuthentic", 
            "psaGrade", "psaConfidence", "psaReason",
            "bgsGrade", "bgsConfidence", "bgsCenteringSub", "bgsCornersSub", "bgsEdgesSub", "bgsSurfaceSub", "bgsReason",
            "aceGrade", "aceConfidence", "aceReason",
            "recommendationService", "recommendationVerdict", "recommendationReason",
            "gradeSummary", "diagnostics"
          ]
        }
      }
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("No response received from the grading model.");
    }

    const parsedResult = JSON.parse(rawText);

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
