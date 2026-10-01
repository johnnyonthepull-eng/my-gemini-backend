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

    console.log("OTPTCG strict metric grading request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    // =========================================================
    // 3. CALL GEMINI API WITH ENFORCED METRIC FIELDS
    // =========================================================
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a master trading card grading inspector and optical metrology expert. Perform a rigorous physical measurement analysis of the provided front and back card images.

              CRITICAL ENFORCEMENT RULES FOR CENTERING:
              - Standard TCG cards measure precisely 63mm wide by 88mm tall. Use this physical scale as your baseline.
              - ABSOLUTE REQUIREMENT: You MUST populate every single sub-field for frontCentering and backCentering ('top', 'bottom', 'left', 'right', and 'ratio'). 
              - NEVER leave 'top', 'bottom', 'left', or 'right' blank, null, or as dashes. 
              - Each directional field must contain an exact physical measurement string in millimeters (e.g. "1.5 mm"). 
              - Treat the card as authentic. Ignore plastic glare, dust on sleeves, or reflections from holders.
              - Provide granular details for corner micro-chipping, edge whitening/silvering, and surface hairline scratches.`
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

            // PSA FIELDS
            psaGrade: { type: Type.STRING, description: "PSA estimated grade e.g. GEM MINT 10 or PSA 9" },
            psaConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
            psaReason: { type: Type.STRING, description: "Thorough paragraph explaining why this PSA grade was awarded." },

            // BGS FIELDS
            bgsGrade: { type: Type.STRING, description: "BGS estimated grade e.g. BGS 9.5" },
            bgsConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
            bgsCenteringSub: { type: Type.STRING, description: "BGS Centering subgrade e.g. 9.5" },
            bgsCornersSub: { type: Type.STRING, description: "BGS Corners subgrade e.g. 9.5" },
            bgsEdgesSub: { type: Type.STRING, description: "BGS Edges subgrade e.g. 9.0" },
            bgsSurfaceSub: { type: Type.STRING, description: "BGS Surface subgrade e.g. 9.5" },
            bgsReason: { type: Type.STRING, description: "Detailed subgrade breakdown rationale." },

            // ACE FIELDS
            aceGrade: { type: Type.STRING, description: "ACE grade e.g. ACE 9" },
            aceConfidence: { type: Type.STRING, description: "Confidence percentage e.g. 95%" },
            aceReason: { type: Type.STRING, description: "Detailed ACE rationale." },

            // RECOMMENDATION & SUMMARY
            recommendationService: { type: Type.STRING, description: "Recommended grading service e.g. PSA" },
            recommendationVerdict: { type: Type.STRING, description: "Grade / Raw / Pass" },
            recommendationReason: { type: Type.STRING, description: "Actionable advice on submission value." },
            gradeSummary: { type: Type.STRING, description: "Comprehensive executive summary of the card's physical condition." },

            // DIAGNOSTICS WITH STRICT STRINGS
            diagnostics: {
              type: Type.OBJECT,
              properties: {
                frontCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.5 mm'" },
                    bottom: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.5 mm'" },
                    left: { type: Type.STRING, description: "Exact measurement in mm, e.g. '2.0 mm'" },
                    right: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.0 mm'" },
                    ratio: { type: Type.STRING, description: "Calculated ratio e.g. 60/40" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.5 mm'" },
                    bottom: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.5 mm'" },
                    left: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.5 mm'" },
                    right: { type: Type.STRING, description: "Exact measurement in mm, e.g. '1.5 mm'" },
                    ratio: { type: Type.STRING, description: "Calculated ratio e.g. 50/50" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Precise description of each corner condition"
                },
                edgeFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Precise description of edge condition"
                },
                surfaceFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Precise description of surface condition"
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
    console.error("OTPTCG strict metric grading error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
