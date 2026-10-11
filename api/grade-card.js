const { GoogleGenAI } = require("@google/genai");

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Cache-Control, Pragma, Expires, X-Requested-With",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on Netlify." })
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch(e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON request payload." })
      };
    }

    const { frontImage, backImage } = body;

    if (!frontImage || !backImage) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Both front and back images are required." })
      };
    }

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are OnThePullTCG’s elite trading card grading master inspector and market intelligence engine. Inspect front and back images for corners, edges, and surface. Provide precise UK market completed sold prices (GBP £) over the last 30 days for PSA, BGS, and ACE grades.`
            },
            { inlineData: { mimeType: "image/jpeg", data: cleanFront } },
            { inlineData: { mimeType: "image/jpeg", data: cleanBack } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            cardName: { type: "STRING" },
            setName: { type: "STRING" },
            cardNumber: { type: "STRING" },
            rarity: { type: "STRING" },
            language: { type: "STRING" },
            variant: { type: "STRING" },
            identificationConfidence: { type: "STRING" },
            isAuthentic: { type: "BOOLEAN" },

            psaGrade: { type: "STRING" },
            psaConfidence: { type: "STRING" },
            psaReason: { type: "STRING" },

            bgsGrade: { type: "STRING" },
            bgsConfidence: { type: "STRING" },
            bgsCenteringSub: { type: "STRING" },
            bgsCornersSub: { type: "STRING" },
            bgsEdgesSub: { type: "STRING" },
            bgsSurfaceSub: { type: "STRING" },
            bgsReason: { type: "STRING" },

            aceGrade: { type: "STRING" },
            aceConfidence: { type: "STRING" },
            aceReason: { type: "STRING" },

            marketPricing: {
              type: "OBJECT",
              properties: {
                psaLastSolds7Days: { type: "STRING" },
                bgsLastSolds7Days: { type: "STRING" },
                aceLastSolds7Days: { type: "STRING" },
                pricingNotes: { type: "STRING" }
              },
              required: ["psaLastSolds7Days", "bgsLastSolds7Days", "aceLastSolds7Days", "pricingNotes"]
            },

            recommendationService: { type: "STRING" },
            recommendationVerdict: { type: "STRING" },
            recommendationReason: { type: "STRING" },
            gradeSummary: { type: "STRING" },

            diagnostics: {
              type: "OBJECT",
              properties: {
                frontCentering: {
                  type: "OBJECT",
                  properties: {
                    top: { type: "STRING" },
                    bottom: { type: "STRING" },
                    left: { type: "STRING" },
                    right: { type: "STRING" },
                    ratio: { type: "STRING" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: "OBJECT",
                  properties: {
                    top: { type: "STRING" },
                    bottom: { type: "STRING" },
                    left: { type: "STRING" },
                    right: { type: "STRING" },
                    ratio: { type: "STRING" }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: { type: "ARRAY", items: { type: "STRING" } },
                edgeFlaws: { type: "ARRAY", items: { type: "STRING" } },
                surfaceFlaws: { type: "ARRAY", items: { type: "STRING" } }
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

    const parsedResult = JSON.parse(response.text);
    parsedResult.isAuthentic = true;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsedResult)
    };

  } catch (error) {
    console.error("Grading error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error during card grading." })
    };
  }
};
