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

    console.log("OTPTCG pricing & inspector request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an elite, uncompromising trading card grading master inspector and market pricing expert for the UK TCG secondary market. 

              CRITICAL INSPECTION & PRICING MANDATES:
              1. PRESUMED AUTHENTICITY: Treat every card submitted as 100% authentic genuine merchandise. NEVER flag a card as counterfeit or fake.
              2. ULTRA-PRECISION DEFECT ANALYSIS: Inspect corners, edges, and surfaces with extreme scrutiny. 
                 - Corners: Micro-chipping, rounding, whitening.
                 - Edges: Chipping, silvering, rough cuts.
                 - Surface: Hairlines, print lines, foil dimples.
              3. EXACT GRADING ACCURACY: Assign realistic, unforgiving sub-grades and overall grades (PSA, BGS, ACE).
              4. METRIC MEASUREMENTS: Provide precise decimal measurements formatted as x.xx mm (e.g., "1.45 mm") for every border field.
              5. UK 7-DAY MARKET PRICING: Provide estimated average sold prices in British Pounds (£) based on actual UK marketplace sales over the last 7 days for the specific calculated grades of PSA, Beckett (BGS), and ACE slabs.`
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

            // PSA FIELDS
            psaGrade: { type: Type.STRING },
            psaConfidence: { type: Type.STRING },
            psaReason: { type: Type.STRING },

            // BGS FIELDS
            bgsGrade: { type: Type.STRING },
            bgsConfidence: { type: Type.STRING },
            bgsCenteringSub: { type: Type.STRING },
            bgsCornersSub: { type: Type.STRING },
            bgsEdgesSub: { type: Type.STRING },
            bgsSurfaceSub: { type: Type.STRING },
            bgsReason: { type: Type.STRING },

            // ACE FIELDS
            aceGrade: { type: Type.STRING },
            aceConfidence: { type: Type.STRING },
            aceReason: { type: Type.STRING },

            // RECENT MARKET SOLDS (UK - LAST 7 DAYS)
            marketPricing: {
              type: Type.OBJECT,
              properties: {
                psaLastSolds7Days: { type: Type.STRING, description: "e.g. '£145.00' based on UK market average for this estimated PSA grade" },
                bgsLastSolds7Days: { type: Type.STRING, description: "e.g. '£160.00' based on UK market average for this estimated BGS grade" },
                aceLastSolds7Days: { type: Type.STRING, description: "e.g. '£110.00' based on UK market average for this estimated ACE grade" },
                pricingNotes: { type: Type.STRING, description: "Brief context on recent UK sales volume or trend" }
              },
              required: ["psaLastSolds7Days", "bgsLastSolds7Days", "aceLastSolds7Days", "pricingNotes"]
            },

            // RECOMMENDATION & SUMMARY
            recommendationService: { type: Type.STRING },
            recommendationVerdict: { type: Type.STRING },
            recommendationReason: { type: Type.STRING },
            gradeSummary: { type: Type.STRING },

            // DIAGNOSTICS
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

    // Force authenticity flag to true always
    parsedResult.isAuthentic = true;

    // Decimal safeguard formatting
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
    console.error("OTPTCG pricing error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
