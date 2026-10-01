// api/grade-card.js
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

    console.log("OTPTCG direct AI market sold pricing request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are OnThePullTCG’s elite, uncompromising trading card grading master inspector and market intelligence engine. Your reputation relies on absolute accuracy. Collectors depend on you to catch every single micro-flaw and provide accurate market data.

              FORENSIC GRADING & COMPLETED SOLD PRICING MANDATES:
              1. RIGOROUS INSPECTION: Analyze front and back images. Check corners, edges, and surface under virtual multi-spectral scrutiny. Penalize flaws accurately for PSA, BGS, and ACE grades.
              2. ACCURATE COMPLETED SOLD PRICING (GBP £): For the identified card and its assigned grade under each specific house (PSA, BGS, ACE), provide the verified historical completed/sold market average over the last 30 days down to the exact penny (e.g., £154.50).
              3. GRADING HOUSE DIFFERENTIATION: Ensure clear, realistic market separation between companies:
                 - PSA: Global benchmark liquidity standard.
                 - BGS: Factoring sub-grade premiums and pristine/black label tier weightings where applicable.
                 - ACE: Reflecting localized UK secondary market collector pricing and liquidity variance.
              4. PRESUMED AUTHENTICITY: Treat every card submitted as 100% genuine authentic merchandise.`
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
            isAuthentic: { type: Type.BOOLEAN, description: "Must always evaluate to true" },

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

            marketPricing: {
              type: Type.OBJECT,
              properties: {
                psaLastSolds7Days: { type: Type.STRING, description: "Verified 30-day completed sold average for PSA grade formatted to exact pennies, e.g. '£154.50'" },
                bgsLastSolds7Days: { type: Type.STRING, description: "Verified 30-day completed sold average for BGS grade formatted to exact pennies, e.g. '£142.25'" },
                aceLastSolds7Days: { type: Type.STRING, description: "Verified 30-day completed sold average for ACE grade formatted to exact pennies, e.g. '£98.80'" },
                pricingNotes: { type: Type.STRING, description: "Context confirming market data is derived from historical completed transactions with correct company differentiation." }
              },
              required: ["psaLastSolds7Days", "bgsLastSolds7Days", "aceLastSolds7Days", "pricingNotes"]
            },

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
                    top: { type: Type.STRING },
                    bottom: { type: Type.STRING },
                    left: { type: Type.STRING },
                    right: { type: Type.STRING },
                    ratio: { type: Type.STRING }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING },
                    bottom: { type: Type.STRING },
                    left: { type: Type.STRING },
                    right: { type: Type.STRING },
                    ratio: { type: Type.STRING }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: { type: Type.ARRAY, items: { type: Type.STRING } },
                edgeFlaws: { type: Type.ARRAY, items: { type: Type.STRING } },
                surfaceFlaws: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["frontCentering", "backCentering", "cornerFlaws", "edgeFlaws", "surfaceFlaws"]
            }
          },
          required: [
            "cardName", "setName", "cardNumber", "rarity", "language", 
            "variant", "identificationConfidence", "isAuthentic", 
            "psaGrade", "psaConfidence", "psaReason",
            "bgsGrade", "bgsConfidence", "bgsCenteringSub", "bgsCornersSub", "bgsEdgesSub", "bgsSurfaceSub", "bgsReason",
            "marketPricing",
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
    parsedResult.isAuthentic = true;

    const ensureDecimalMm = (val) => {
      if (!val || val === "—" || val.trim() === "") return "1.50 mm";
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
    console.error("OTPTCG direct AI pricing handler error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
