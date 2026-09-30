import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req, res) {
  // -------------------------------------------------------
  // CORS
  // -------------------------------------------------------

  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://onthepulltcg.com"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Also allow www version
  const origin = req.headers.origin;

  if (
    origin === "https://onthepulltcg.com" ||
    origin === "https://www.onthepulltcg.com"
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  } else {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );
  }

  // -------------------------------------------------------
  // OPTIONS / CORS PREFLIGHT
  // -------------------------------------------------------

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // -------------------------------------------------------
  // METHOD CHECK
  // -------------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    // -----------------------------------------------------
    // CHECK REQUEST BODY
    // -----------------------------------------------------

    const body = req.body || {};

    const {
      frontBase64,
      backBase64,
    } = body;

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({
        error:
          "Missing front or back image payload.",
      });
    }

    console.log(
      "Front image received:",
      Math.round(frontBase64.length / 1024),
      "KB"
    );

    console.log(
      "Back image received:",
      Math.round(backBase64.length / 1024),
      "KB"
    );

    // -----------------------------------------------------
    // GEMINI PROMPT
    // -----------------------------------------------------

    const gradingSystemInstruction = `
You are an expert trading card identification and grading
pre-screening assistant.

Analyze the provided FRONT and BACK photographs.

IMPORTANT:
- Do not claim to have physically measured the card in millimeters.
- Do not claim to have used infrared, ultraviolet, blue-light,
  or other equipment that was not actually provided.
- Only identify flaws that are reasonably visible in the supplied
  photographs.
- Centering measurements are estimates from the photographs.
- Grades are estimates and NOT official PSA, BGS or ACE grades.
- Do not invent information when the photograph does not provide
  enough evidence.
- If card identification is uncertain, say so.

Identify:

1. Card name
2. Set
3. Card number
4. Rarity
5. Language
6. Variant

Then estimate:

PSA grade
BGS grade
BGS subgrades:
- Centering
- Corners
- Edges
- Surface

ACE grade

Also provide:

- Front centering
- Back centering
- Corner flaws
- Edge flaws
- Surface flaws
- Overall condition summary
- A grading-service recommendation

The recommendation should be based on the observed condition
and the estimated grades. Do not claim that one company will
definitely produce a particular grade.

Return JSON ONLY.

Use this exact structure:

{
  "cardIdentification": {
    "cardName": "",
    "setName": "",
    "cardNumber": "",
    "rarity": "",
    "language": "",
    "variant": "",
    "identificationConfidence": ""
  },

  "companyPredictions": {

    "PSA": {
      "predictedGrade": "",
      "confidence": "",
      "reasoning": ""
    },

    "BGS": {
      "predictedGrade": "",
      "confidence": "",
      "estimatedSubgrades": {
        "centering": "",
        "corners": "",
        "edges": "",
        "surface": ""
      },
      "reasoning": ""
    },

    "ACE": {
      "predictedGrade": "",
      "confidence": "",
      "reasoning": ""
    }

  },

  "subgrades": {
    "centeringFront": "",
    "centeringBack": "",
    "cornersFlaws": [],
    "edgesFlaws": [],
    "surfaceFlaws": []
  },

  "gradeSummary": "",

  "recommendation": {
    "service": "",
    "estimatedGrade": "",
    "verdict": "",
    "reason": ""
  }
}
`;

    // -----------------------------------------------------
    // GEMINI REQUEST
    // -----------------------------------------------------

    const response =
      await ai.models.generateContent({

        model: "gemini-2.5-flash",

        contents: [
          {
            role: "user",

            parts: [

              {
                text:
                  "Analyze the trading card shown in the following front and back images."
              },

              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: frontBase64,
                },
              },

              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: backBase64,
                },
              },

            ],
          },
        ],

        config: {

          systemInstruction:
            gradingSystemInstruction,

          responseMimeType:
            "application/json",

          temperature: 0.1,

        },

      });


    // -----------------------------------------------------
    // GEMINI RESPONSE
    // -----------------------------------------------------

    const responseText =
      response.text;

    if (!responseText) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    console.log(
      "Gemini response received."
    );


    // -----------------------------------------------------
    // PARSE JSON
    // -----------------------------------------------------

    let cleanJson =
      responseText.trim();

    if (
      cleanJson.startsWith("```json")
    ) {
      cleanJson =
        cleanJson
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim();
    }

    if (
      cleanJson.startsWith("```")
    ) {
      cleanJson =
        cleanJson
          .replace(/^```/, "")
          .replace(/```$/, "")
          .trim();
    }


    const data =
      JSON.parse(cleanJson);


    // -----------------------------------------------------
    // RETURN RESULT
    // -----------------------------------------------------

    return res.status(200).json(
      data
    );


  } catch (error) {

    console.error(
      "CARD GRADING ERROR:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Internal server error during card analysis.",

    });

  }
}
