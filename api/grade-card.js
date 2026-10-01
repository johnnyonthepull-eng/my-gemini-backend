import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
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
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { frontImage, backImage, sessionNonce } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Both frontImage and backImage are required." });
    }

    console.log("OTPTCG decimal metric request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a master trading card grading inspector and optical metrology expert. Perform a rigorous physical measurement analysis of the provided front and back card images.

              CRITICAL MEASUREMENT RULES:
              - Standard TCG cards measure precisely 63mm wide by 88mm tall. 
              - You MUST provide precise decimal measurements formatted as x.xx mm (e.g., "1.45 mm", "2.10 mm", "0.95 mm") for every single top, bottom, left, and right border field. Never use integers, dashes, or blank fields.`
            },
            { inlineData: { mimeType: "image/jpeg", data: cleanFront } },
            { inlineData: { mimeType: "image/jpeg", data: cleanBack } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cardName: { type: Type.STRING },
            setName: { type: Type.STRING },
            cardNumber: { type: Type.STRING },
            rarity: { type: Type.STRING },
            language: { type: Type.STRING },
            variant: { type: Type.STRING },
            identificationConfidence: { type: Type.STRING },
            isAuthentic: { type: Type.BOOLEAN },

            psaGrade: { type: Type.STRING },
            psaConfidence: { type: Type.STRING },
            psaReason: { type: Type.STRING },

            bgsGrade: { type: Type.STRING },
            bgsConfidence: { type: Type.STRING },
            bgsCenteringSub: { type: Type.STRING },
            bgsCornersSub: { type: Type.STRING },
            bgsEdgesSub: { type: Type.STRING },
            bgsSurfaceSub: { type: Type.STRING },
            bgsReason: { type: Type.STRING },

            aceGrade: { type: Type.STRING },
            aceConfidence: { type: Type.STRING },
            aceReason: { type: Type.STRING },

            recommendationService: { type: Type.STRING },
            recommendationVerdict: { type: Type.STRING },
            recommendationReason: { type: Type.STRING },
            gradeSummary: { type: Type.STRING },

            diagnostics: {
              type: Type.OBJECT,
              properties: {
                frontCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Decimal measurement e.g. '1.45 mm'" },
                    bottom: { type: Type.STRING, description: "Decimal measurement e.g. '1.55 mm'" },
                    left: { type: Type.STRING, description: "Decimal measurement e.g. '2.10 mm'" },
                    right: { type: Type.STRING, description: "Decimal measurement e.g. '1.90 mm'" },
                    ratio: { type: Type.STRING, description: "Calculated ratio e.g. '53/47'" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "Decimal measurement e.g. '1.50 mm'" },
                    bottom: { type: Type.STRING, description: "Decimal measurement e.g. '1.50 mm'" },
                    left: { type: Type.STRING, description: "Decimal measurement e.g. '1.75 mm'" },
                    right: { type: Type.STRING, description: "Decimal measurement e.g. '1.25 mm'" },
                    ratio: { type: Type.STRING, description: "Calculated ratio e.g. '50/50'" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                edgeFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                surfaceFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
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
    // 4. BACKEND DECIMAL FORMATTING SAFEGUARD
    // =========================================================
    const ensureDecimalMm = (val) => {
      if (!val || val === "—" || val.trim() === "") return "1.50 mm";
      // If it's already got letters/units like "1.5 mm" or "1.50 mm", normalize it
      const cleaned = val.replace(/[^0-9.]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) return "1.50 mm";
      return `${num.toFixed(2)} mm`;
    };

    if (parsedResult.diagnostics && parsedResult.diagnostics.frontCentering) {
      const fc = parsedResult.diagnostics.frontCentering;
      fc.top = ensureDecimalMm(fc.top);
      fc.bottom = ensureDecimalMm(fc.bottom);
      fc.left = ensureDecimalMm(fc.left);
      fc.right = ensureDecimalMm(fc.right);
    }

    if (parsedResult.diagnostics && parsedResult.diagnostics.backCentering) {
      const bc = parsedResult.diagnostics.backCentering;
      bc.top = ensureDecimalMm(bc.top);
      bc.bottom = ensureDecimalMm(bc.bottom);
      bc.left = ensureDecimalMm(bc.left);
      bc.right = ensureDecimalMm(bc.right);
    }

    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("OTPTCG decimal metric error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
