import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Retry wrapper to ensure resilience against traffic spikes
async function generateWithRetry(params, retries = 3, delay = 1000) {
  try {
    return await ai.models.generateContent(params);
  } catch (err) {
    if (retries > 0 && (err.status === 503 || err.message?.includes('503') || err.message?.includes('overloaded'))) {
      console.warn(`Model busy, retrying in \({delay}ms... (\){retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateWithRetry(params, retries - 1, delay * 2);
    }
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { frontBase64, backBase64 } = req.body || {};

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({ error: 'Missing front or back image payload.' });
    }

    const gradingSystemInstruction = `
You are an elite, hyper-precise trading card authentication and grading AI equipped with advanced computer-vision simulation capabilities, including optical millimeter border measurement, simulated infrared (IR) surface scattering, and blue-light spectrum filtering.

Analyze the front and back images with absolute forensic precision and return valid JSON only.

1. EXACT MILLIMETER CENTERING MEASUREMENT (100% Precision):
- Mathematically measure the exact border widths in millimeters (or fractional ratios) for Top, Bottom, Left, and Right on both the front and back.
- Format example: "Left 2.0mm / Right 2.5mm - 55/45".

2. SIMULATED INFRARED & BLUE-LIGHT SURFACE/EDGE/CORNER ANALYSIS:
- Simulate Infrared (IR) filtering across the card surface to detect heat signatures of micro-creases, subsurface indentations, pressure dents, and foil warping.
- Simulate Blue-Light spectrum filtering to isolate surface gloss integrity, hairline scratches, print lines, roller marks, and microscopic corner fraying or edge whitening.

3. COMPANY-SPECIFIC GRADING STANDARDS:
- BECKETT (BGS): Extremely strict and rigid. Enforces strict subgrade mathematical limits. Zero tolerance for flaws found via IR/blue-light inspection.
- PSA: Accurate, slightly more forgiving on minor back-surface or centering variances if the front presentation is pristine.
- ACE GRADING: Collector-friendly, slightly more lenient on minor factory quirks while rewarding clean eye appeal.

Provide a detailed condition analysis and grade estimations matching this exact JSON structure:
{
  "companyPredictions": {
    "PSA": {
      "predictedGrade": "PSA 9",
      "reasoning": "..."
    },
    "BGS": {
      "predictedGrade": "9.5",
      "estimatedSubgrades": {
        "centering": "9.5",
        "corners": "9.5",
        "edges": "9.0",
        "surface": "10"
      },
      "reasoning": "..."
    },
    "ACE": {
      "predictedGrade": "ACE 9",
      "reasoning": "..."
    }
  },
  "subgrades": {
    "centeringFront": "Exact mm measurements and ratio",
    "centeringBack": "Exact mm measurements and ratio",
    "cornersFlaws": ["List specific micro-flaws detected under blue-light/IR simulation"],
    "edgesFlaws": ["List specific edge chipping, silvering, or rough cuts detected"]
  }
}
`;

    const response = await generateWithRetry({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Analyze these front and back trading card images and provide the precise forensic grade report in JSON format." },
            {
              inlineData: {
                data: frontBase64,
                mimeType: "image/jpeg"
              }
            },
            {
              inlineData: {
                data: backBase64,
                mimeType: "image/jpeg"
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: gradingSystemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const responseText = response.text;
    const data = JSON.parse(responseText);

    return res.status(200).json(data);

  } catch (err) {
    console.error("Vercel Function Error:", err);
    return res.status(500).json({ 
      error: err.message || 'Internal server error processing images with Gemini.' 
    });
  }
}
