import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { frontImage, backImage, sessionNonce } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Both frontImage and backImage are required." });
    }

    console.log("OTPTCG grading request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            cardName: { type: SchemaType.STRING },
            setName: { type: SchemaType.STRING },
            cardNumber: { type: SchemaType.STRING },
            rarity: { type: SchemaType.STRING },
            language: { type: SchemaType.STRING },
            variant: { type: SchemaType.STRING },
            identificationConfidence: { type: SchemaType.STRING },
            isAuthentic: { type: SchemaType.BOOLEAN },

            psaGrade: { type: SchemaType.STRING },
            psaConfidence: { type: SchemaType.STRING },
            psaReason: { type: SchemaType.STRING },

            bgsGrade: { type: SchemaType.STRING },
            bgsConfidence: { type: SchemaType.STRING },
            bgsCenteringSub: { type: SchemaType.STRING },
            bgsCornersSub: { type: SchemaType.STRING },
            bgsEdgesSub: { type: SchemaType.STRING },
            bgsSurfaceSub: { type: SchemaType.STRING },
            bgsReason: { type: SchemaType.STRING },

            aceGrade: { type: SchemaType.STRING },
            aceConfidence: { type: SchemaType.STRING },
            aceReason: { type: SchemaType.STRING },

            recommendationService: { type: SchemaType.STRING },
            recommendationVerdict: { type: SchemaType.STRING },
            recommendationReason: { type: SchemaType.STRING },
            gradeSummary: { type: SchemaType.STRING },

            diagnostics: {
              type: SchemaType.OBJECT,
              properties: {
                frontCentering: {
                  type: SchemaType.OBJECT,
                  properties: {
                    top: { type: SchemaType.STRING },
                    bottom: { type: SchemaType.STRING },
                    left: { type: SchemaType.STRING },
                    right: { type: SchemaType.STRING },
                    ratio: { type: SchemaType.STRING }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: SchemaType.OBJECT,
                  properties: {
                    top: { type: SchemaType.STRING },
                    bottom: { type: SchemaType.STRING },
                    left: { type: SchemaType.STRING },
                    right: { type: SchemaType.STRING },
                    ratio: { type: SchemaType.STRING }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                edgeFlaws: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                surfaceFlaws: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
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

    const prompt = `Analyze the provided front and back card images. Provide a comprehensive professional grading report. Treat the card as 100% authentic, ignore holder plastic glare, populate every single text field thoroughly with deep detail, and provide exact centering percentages and ratios.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: "image/jpeg", data: cleanFront } },
      { inlineData: { mimeType: "image/jpeg", data: cleanBack } }
    ]);

    const rawText = result.response.text();
    if (!rawText) throw new Error("No response received from model.");

    return res.status(200).json(JSON.parse(rawText));

  } catch (error) {
    console.error("OTPTCG grade-card error:", error);
    return res.status(500).json({ error: error.message || "Card grading failed." });
  }
}
