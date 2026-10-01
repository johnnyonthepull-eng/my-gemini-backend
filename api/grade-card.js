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

    console.log("OTPTCG master inspector request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an elite, uncompromising trading card grading master inspector and optical metrology expert working for a premier grading service. 

              CRITICAL INSPECTION MANDATES:
              1. PRESUMED AUTHENTICITY: Treat every card submitted as 100% authentic genuine merchandise. NEVER flag a card as counterfeit, fake, or unauthentic due to camera lighting, sleeve glare, scanning artifacts, or foil reflections. Evaluate condition strictly on its physical merits.
              2. ULTRA-PRECISION DEFECT ANALYSIS: Inspect the corners, edges, and surfaces with extreme microscopic scrutiny. 
                 - Corners: Identify micro-chipping, slight rounding, corner layering separation, or bottom-layer whitening.
                 - Edges: Detect minor edge chipping, silvering, whitening along the back borders, or factory edge rough cutting.
                 - Surface: Hunt for microscopic hairline scratches, surface print lines, foil dimples, minor indentations, or fingerprint oils.
              3. EXACT GRADING ACCURACY: Assign realistic, unforgiving sub-grades and final grades (PSA, BGS, ACE) based strictly on professional grading standards (e.g., PSA 10 requires pristine gem mint qualities; a single speck of whitening or a hairline scratch drops it to a 9 or lower).
              4. METRIC MEASUREMENTS: Provide precise decimal measurements formatted as x.xx mm (e.g., "1.45 mm") for every border field.`
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
            psaGrade: { type: Type.STRING, description: "Precise PSA estimated grade e.g. GEM MINT 10, PSA 9, PSA 8" },
            psaConfidence: { type: Type.STRING },
            psaReason: { type: Type.STRING, description: "Detailed justification based on exact corner, edge, surface, and centering flaws." },

            // BGS FIELDS
            bgsGrade: { type: Type.STRING, description: "BGS estimated overall grade e.g. BGS 9.5" },
            bgsConfidence: { type: Type.STRING },
            bgsCenteringSub: { type: Type.STRING, description: "Strict subgrade e.g. 9.5" },
            bgsCornersSub: { type: Type.STRING, description: "Strict subgrade e.g. 9.0" },
            bgsEdgesSub: { type: Type.STRING, description: "Strict subgrade e.g. 9.5" },
            bgsSurfaceSub: { type: Type.STRING, description: "Strict subgrade e.g. 8.5" },
            bgsReason: { type: Type.STRING, description: "Detailed subgrade breakdown rationale." },

            // ACE FIELDS
            aceGrade: { type: Type.STRING },
            aceConfidence: { type: Type.STRING },
            aceReason: { type: Type.STRING },

            // RECOMMENDATION & SUMMARY
            recommendationService: { type: Type.STRING },
            recommendationVerdict: { type: Type.STRING },
            recommendationReason: { type: Type.STRING },
            gradeSummary: { type: Type.STRING, description: "Comprehensive breakdown of all physical defects found." },

            // DIAGNOSTICS
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
                  items: { type: Type.STRING },
                  description: "Ultra-precise breakdown for top-left, top-right, bottom-left, bottom-right corners"
                },
                edgeFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Ultra-precise breakdown for top, bottom, left, and right card edges"
                },
                surfaceFlaws: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Ultra-precise breakdown for front and back surface textures, scratches, and print lines"
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
    console.error("OTPTCG master inspector error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
