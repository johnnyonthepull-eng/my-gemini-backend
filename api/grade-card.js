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

    console.log("OTPTCG metric fallback request received. Nonce:", sessionNonce || "none");

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
              - You MUST provide explicit millimeter values for top, bottom, left, and right borders for both front and back (e.g., "1.5 mm"). Never leave them blank.`
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
                    top: { type: Type.STRING, description: "e.g. '1.5 mm'" },
                    bottom: { type: Type.STRING, description: "e.g. '1.5 mm'" },
                    left: { type: Type.STRING, description: "e.g. '2.0 mm'" },
                    right: { type: Type.STRING, description: "e.g. '1.0 mm'" },
                    ratio: { type: Type.STRING, description: "e.g. '51/49'" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING, description: "e.g. '1.5 mm'" },
                    bottom: { type: Type.STRING, description: "e.g. '1.5 mm'" },
                    left: { type: Type.STRING, description: "e.g. '1.5 mm'" },
                    right: { type: Type.STRING, description: "e.g. '1.5 mm'" },
                    ratio: { type: Type.STRING, description: "e.g. '53/47'" }
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
    // 4. BACKEND SANITIZATION & SAFEGUARD FALLBACK
    // =========================================================
    if (parsedResult.diagnostics && parsedResult.diagnostics.frontCentering) {
      const fc = parsedResult.diagnostics.frontCentering;
      if (!fc.top || fc.top === "—" || fc.top.trim() === "") fc.top = "1.5 mm";
      if (!fc.bottom || fc.bottom === "—" || fc.bottom.trim() === "") fc.bottom = "1.5 mm";
      if (!fc.left || fc.left === "—" || fc.left.trim() === "") fc.left = "1.5 mm";
      if (!fc.right || fc.right === "—" || fc.right.trim() === "") fc.right = "1.5 mm";
    }

    if (parsedResult.diagnostics && parsedResult.diagnostics.backCentering) {
      const bc = parsedResult.diagnostics.backCentering;
      if (!bc.top || bc.top === "—" || bc.top.trim() === "") bc.top = "1.5 mm";
      if (!bc.bottom || bc.bottom === "—" || bc.bottom.trim() === "") bc.bottom = "1.5 mm";
      if (!bc.left || bc.left === "—" || bc.left.trim() === "") bc.left = "1.5 mm";
      if (!bc.right || bc.right === "—" || bc.right.trim() === "") bc.right = "1.5 mm";
    }

    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("OTPTCG fallback error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
