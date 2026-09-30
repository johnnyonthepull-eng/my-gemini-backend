import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.8-flash";

export const config = {
  runtime: "edge",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

function parseImage(dataUrl) {
  if (!dataUrl) {
    throw new Error("Image data is missing.");
  }

  // Accept either a complete data URL or raw base64.
  if (dataUrl.startsWith("data:")) {
    const match = dataUrl.match(
      /^data:([^;]+);base64,(.+)$/
    );

    if (!match) {
      throw new Error("Invalid image data URL.");
    }

    return {
      mimeType: match[1],
      data: match[2],
    };
  }

  return {
    mimeType: "image/jpeg",
    data: dataUrl,
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed. Use POST.",
      },
      405
    );
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured in Vercel."
      );
    }

    const body = await req.json();

    const frontBase64 =
      body.frontBase64 || body.frontImage;

    const backBase64 =
      body.backBase64 || body.backImage;

    if (!frontBase64 || !backBase64) {
      return jsonResponse(
        {
          error:
            "Missing front or back image.",
        },
        400
      );
    }

    const front = parseImage(frontBase64);
    const back = parseImage(backBase64);

    const systemInstruction = `
You are an expert trading card condition pre-screening AI.

You analyze photographs of trading cards and provide realistic
pre-screening estimates for PSA, Beckett/BGS and ACE Grading.

IMPORTANT LIMITATIONS:

- You are analyzing photographs only.
- Do NOT claim to perform infrared scanning.
- Do NOT claim to perform blue-light scanning.
- Do NOT claim to measure physical millimeters with 100% precision.
- Do NOT claim that a grade is guaranteed.
- Do NOT claim that you can detect hidden dents, indentations,
  creases or microscopic defects that cannot actually be seen
  in the supplied photographs.
- Clearly distinguish visible evidence from uncertainty.

Centering should be expressed as an ESTIMATED ratio based on
visible borders.

Analyze both the front AND back carefully.

Look for:

1. Centering
2. Corners
3. Edges
4. Surface
5. Whitening
6. Chipping
7. Silvering
8. Print lines
9. Scratches
10. Scuffs
11. Visible dents
12. Visible creases
13. Visible alignment issues
14. Cutting or print-quality issues

For each grading company provide a realistic estimated grade.

PSA:
Use the PSA-style 1-10 scale.

BGS:
Use Beckett-style grades and provide:
- Centering
- Corners
- Edges
- Surface

ACE:
Provide an estimated ACE-style numerical grade.

CARD IDENTIFICATION:

Identify, where possible:
- Card name
- Set
- Card number
- Rarity
- Language
- Variant

Do not invent card information.

If identification is uncertain, say so.

RECOMMENDATION:

The recommendation must be based on the photographed condition
and the estimated grades.

You may recommend PSA, BGS or ACE based on how the card appears
to fit the estimated grading characteristics.

Do NOT claim the recommendation guarantees increased resale value.

Return ONLY valid JSON.
No markdown.
No code fences.
`;

    const userPrompt = `
Analyze the following trading card.

The first image is the FRONT.
The second image is the BACK.

Identify the card and provide the complete condition
pre-screening report.

Pay particular attention to:
- front centering
- back centering
- corners
- edges
- surface
- visible whitening
- visible scratches
- visible print lines
- visible dents
- visible creases
- visible alignment issues

Return the exact JSON structure requested.
`;

    const response = await ai.models.generateContent({
      model: MODEL,

      contents: [
        {
          role: "user",
          parts: [
            {
              text: userPrompt,
            },

            {
              inlineData: {
                mimeType: front.mimeType,
                data: front.data,
              },
            },

            {
              inlineData: {
                mimeType: back.mimeType,
                data: back.data,
              },
            },
          ],
        },
      ],

      config: {
        systemInstruction,

        responseMimeType:
          "application/json",

        thinkingConfig: {
          thinkingLevel: "medium",
        },

        responseSchema: {
          type: "object",

          properties: {
            cardIdentification: {
              type: "object",

              properties: {
                cardName: {
                  type: "string",
                },

                setName: {
                  type: "string",
                },

                cardNumber: {
                  type: "string",
                },

                rarity: {
                  type: "string",
                },

                language: {
                  type: "string",
                },

                variant: {
                  type: "string",
                },

                identificationConfidence: {
                  type: "string",
                },
              },

              required: [
                "cardName",
                "setName",
                "cardNumber",
                "rarity",
                "language",
                "variant",
                "identificationConfidence",
              ],
            },

            companyPredictions: {
              type: "object",

              properties: {
                PSA: {
                  type: "object",

                  properties: {
                    predictedGrade: {
                      type: "string",
                    },

                    confidence: {
                      type: "string",
                    },

                    reasoning: {
                      type: "string",
                    },
                  },

                  required: [
                    "predictedGrade",
                    "confidence",
                    "reasoning",
                  ],
                },

                BGS: {
                  type: "object",

                  properties: {
                    predictedGrade: {
                      type: "string",
                    },

                    confidence: {
                      type: "string",
                    },

                    estimatedSubgrades: {
                      type: "object",

                      properties: {
                        centering: {
                          type: "string",
                        },

                        corners: {
                          type: "string",
                        },

                        edges: {
                          type: "string",
                        },

                        surface: {
                          type: "string",
                        },
                      },

                      required: [
                        "centering",
                        "corners",
                        "edges",
                        "surface",
                      ],
                    },

                    reasoning: {
                      type: "string",
                    },
                  },

                  required: [
                    "predictedGrade",
                    "confidence",
                    "estimatedSubgrades",
                    "reasoning",
                  ],
                },

                ACE: {
                  type: "object",

                  properties: {
                    predictedGrade: {
                      type: "string",
                    },

                    confidence: {
                      type: "string",
                    },

                    reasoning: {
                      type: "string",
                    },
                  },

                  required: [
                    "predictedGrade",
                    "confidence",
                    "reasoning",
                  ],
                },
              },

              required: [
                "PSA",
                "BGS",
                "ACE",
              ],
            },

            subgrades: {
              type: "object",

              properties: {
                centeringFront: {
                  type: "string",
                },

                centeringBack: {
                  type: "string",
                },

                cornersFlaws: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },

                edgesFlaws: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },

                surfaceFlaws: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              },

              required: [
                "centeringFront",
                "centeringBack",
                "cornersFlaws",
                "edgesFlaws",
                "surfaceFlaws",
              ],
            },

            gradeSummary: {
              type: "string",
            },

            recommendation: {
              type: "object",

              properties: {
                service: {
                  type: "string",
                },

                verdict: {
                  type: "string",
                },

                reason: {
                  type: "string",
                },
              },

              required: [
                "service",
                "verdict",
                "reason",
              ],
            },
          },

          required: [
            "cardIdentification",
            "companyPredictions",
            "subgrades",
            "gradeSummary",
            "recommendation",
          ],
        },
      },
    });

    let text =
      response.text || "";

    text = text.trim();

    // Remove accidental markdown fences if returned.
    if (text.startsWith("```json")) {
      text = text
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    if (text.startsWith("```")) {
      text = text
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    const result =
      JSON.parse(text);

    return jsonResponse(
      result,
      200
    );

  } catch (error) {

    console.error(
      "CARD GRADING ERROR:",
      error
    );

    return jsonResponse(
      {
        error:
          error?.message ||
          "Gemini card analysis failed.",
      },
      500
    );
  }
}
