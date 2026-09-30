import { GoogleGenAI } from '@google/genai';
import formidable from 'formidable';
import fs from 'fs';

// Disable default body parser so formidable can handle raw multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req) => {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

export default async function handler(req, res) {
  // CORS Headers for Shopify storefront
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    const { files } = await parseForm(req);

    // Formidable handles single files or arrays depending on version
    const frontFileObj = Array.isArray(files.frontImage) ? files.frontImage[0] : files.frontImage;
    const backFileObj = Array.isArray(files.backImage) ? files.backImage[0] : files.backImage;

    if (!frontFileObj || !backFileObj) {
      return res.status(400).json({ error: 'Both frontImage and backImage files are required.' });
    }

    // Read raw files into base64 for Gemini
    const frontBuffer = fs.readFileSync(frontFileObj.filepath);
    const backBuffer = fs.readFileSync(backFileObj.filepath);

    const frontBase64 = frontBuffer.toString('base64');
    const backBase64 = backBuffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelToUse = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const promptText = `You are an expert trading card grading assistant and authenticator for OnThePullTCG. Inspect the provided front and back images of this trading card with extreme scrutiny. Provide a thorough, professional evaluation.`;

    // Define response schema for structured JSON output matching your UI
    const responseSchema = {
      type: "OBJECT",
      properties: {
        identification: {
          type: "OBJECT",
          properties: {
            cardName: { type: "STRING" },
            setName: { type: "STRING" },
            cardNumber: { type: "STRING" },
            rarity: { type: "STRING" },
            language: { type: "STRING" },
            variant: { type: "STRING" },
            confidence: { type: "STRING" }
          },
          required: ["cardName", "setName", "cardNumber", "rarity", "language", "variant", "confidence"]
        },
        grades: {
          type: "OBJECT",
          properties: {
            psa: {
              type: "OBJECT",
              properties: {
                grade: { type: "STRING" },
                confidence: { type: "STRING" },
                reasoning: { type: "STRING" }
              },
              required: ["grade", "confidence", "reasoning"]
            },
            bgs: {
              type: "OBJECT",
              properties: {
                grade: { type: "STRING" },
                confidence: { type: "STRING" },
                subgrades: {
                  type: "OBJECT",
                  properties: {
                    centering: { type: "STRING" },
                    corners: { type: "STRING" },
                    edges: { type: "STRING" },
                    surface: { type: "STRING" }
                  },
                  required: ["centering", "corners", "edges", "surface"]
                },
                reasoning: { type: "STRING" }
              },
              required: ["grade", "confidence", "subgrades", "reasoning"]
            },
            ace: {
              type: "OBJECT",
              properties: {
                grade: { type: "STRING" },
                confidence: { type: "STRING" },
                reasoning: { type: "STRING" }
              },
              required: ["grade", "confidence", "reasoning"]
            }
          },
          required: ["psa", "bgs", "ace"]
        },
        recommendation: {
          type: "OBJECT",
          properties: {
            bestService: { type: "STRING" },
            verdict: { type: "STRING" },
            reason: { type: "STRING" }
          },
          required: ["bestService", "verdict", "reason"]
        },
        summary: { type: "STRING" },
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
            flaws: {
              type: "OBJECT",
              properties: {
                corners: { type: "ARRAY", items: { type: "STRING" } },
                edges: { type: "ARRAY", items: { type: "STRING" } },
                surface: { type: "ARRAY", items: { type: "STRING" } }
              },
              required: ["corners", "edges", "surface"]
            }
          },
          required: ["frontCentering", "backCentering", "flaws"]
        }
      },
      required: ["identification", "grades", "recommendation", "summary", "diagnostics"]
    };

    console.log(`Using model: ${modelToUse}`);

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [
        {
          inlineData: {
            mimeType: frontFileObj.mimetype || 'image/jpeg',
            data: frontBase64
          }
        },
        {
          inlineData: {
            mimeType: backFileObj.mimetype || 'image/jpeg',
            data: backBase64
          }
        },
        {
          text: promptText
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const responseText = response.text();
    const parsedData = JSON.parse(responseText);
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error('OTPTCG Backend Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during analysis.' });
  }
}
