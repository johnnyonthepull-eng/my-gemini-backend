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
    // 3. CALL GEMINI API WITH STRICT DETAILED SCHEMA
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
              - DO NOT leave any fields blank, use dashes, or use lazy placeholders. Every single text field must contain rich, detailed professional grading data.
              - Treat the card as 100% authentic. Ignore plastic glare/reflections from sleeves, toploaders, or holders.
              - Provide deep, descriptive analysis for corners, edges, and surface flaws instead of just saying "Clean". Describe micro-details (e.g., slight corner crispness, microscopic edge chipping, print lines, gloss condition).
              - Provide exact percentage estimates for all individual centering sides (top, bottom, left, right) rather than leaving them blank.`
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
            psa: {
              type: Type.OBJECT,
              properties: {
                grade: { type: Type.STRING, description: "PSA estimated grade e.g. GEM MINT 10 or PSA 9" },
                confidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
                reason: { type: Type.STRING, description: "Thorough paragraph explaining why this PSA grade was awarded based on corners, edges, and surface." }
              },
              required: ["grade", "confidence", "reason"]
            },
            bgs: {
              type: Type.OBJECT,
              properties: {
                grade: { type: Type.STRING, description: "BGS estimated grade e.g. BGS 9.5" },
                confidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
                subgrades: {
                  type: Type.OBJECT,
                  properties: {
                    centering: { type: Type.STRING, description: "Subgrade score e.g. 9.5" },
                    corners: { type: Type.STRING, description: "Subgrade score e.g. 9.5" },
                    edges: { type: Type.STRING, description: "Subgrade score e.g. 9.0" },
                    surface: { type: Type.STRING, description: "Subgrade score e.g. 9.5" }
                  },
                  required: ["centering", "corners", "edges", "surface"]
                },
                reason: { type: Type.STRING, description: "Detailed subgrade breakdown rationale." }
              },
              required: ["grade", "confidence", "subgrades", "reason"]
            },
            ace: {
              type: Type.OBJECT,
              properties: {
                grade: { type: Type.STRING, description: "ACE grade e.g. ACE 9" },
                confidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
                reason: { type: Type.STRING, description: "Detailed ACE rationale." }
              },
              required: ["grade", "confidence", "reason"]
            },
            recommendation: {
              type: Type.OBJECT,
              properties: {
                service: { type: Type.STRING, description: "Recommended grading service e.g. PSA" },
                verdict: { type: Type.STRING, description: "Grade / Raw / Pass" },
                reason: { type: Type.STRING, description: "Actionable advice on submission value and instruction to remove from holder before final send-in." }
              },
              required: ["service", "verdict", "reason"]
            },
            gradeSummary: { type: Type.STRING, description: "Comprehensive, multi-sentence executive summary of the card's physical condition." },
            diagnostics: {
              type: Type.OBJECT,
              properties: {
                frontCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    bottom: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    left: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    right: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    ratio: { type: Type.STRING, description: "Ratio e.g. 50/50" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    bottom: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    left: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    right: { type: Type.STRING, description: "Must be a clear percentage e.g. 50%" },
                    ratio: { type: Type.STRING, description: "Ratio e.g. 50/50" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Detailed descriptions of corner condition (e.g. Sharp 90-degree corners, pristine points, zero whitening observed)"
                },
                edgeFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Detailed descriptions of edge condition (e.g. Clean borders, minor factory cut texture along top edge)"
                },
                surfaceFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Detailed descriptions of surface condition (e.g. Glossy finish, vibrant foil reflection, no scratching or print lines)"
                }
              },
              required: ["frontCentering", "backCentering", "cornerFlaws", "edgeFlaws", "surfaceFlaws"]
            }
          },
          required: [
            "cardName", "setName", "cardNumber", "rarity", "language", 
            "variant", "identificationConfidence", "isAuthentic", "psa", 
            "bgs", "ace", "recommendation", "gradeSummary", "diagnostics"
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
