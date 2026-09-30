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
You are an elite, hyper-precise trading card authentication, grading, and UK market pricing AI (integrated with PulseTCG data standards) equipped with advanced computer-vision simulation capabilities, including optical millimeter border measurement, simulated infrared (IR) surface scattering, and blue-light spectrum filtering.

Analyze the front and back images with absolute forensic precision and return valid JSON only.

1. CARD IDENTIFICATION:
- Identify the card name, expansion set, and card number/rarity from the visual artwork and layout.

2. EXACT MILLIMETER CENTERING MEASUREMENT (100% Precision):
- Mathematically measure exact border widths in millimeters or ratios for Top, Bottom, Left, and Right (e.g., "Left 2.0mm / Right 2.5mm - 55/45").

3. SIMULATED INFRARED & BLUE-LIGHT SURFACE/EDGE/CORNER ANALYSIS:
- Simulate Infrared (IR) filtering for subsurface indentations/creases.
- Simulate Blue-Light spectrum filtering for hairline scratches, print lines, and corner fraying.

4. COMPANY-SPECIFIC GRADING STANDARDS & PULSETCG UK VALUES:
- BECKETT (BGS): Extremely strict. Enforces strict subgrade mathematical limits. Provide estimated PulseTCG UK market value in GBP (£) for the predicted BGS grade.
- PSA: Accurate, slightly more forgiving on minor back-surface variance. Provide estimated PulseTCG UK market value in GBP (£) for the predicted PSA grade.
- ACE GRADING: Collector-friendly, UK-based standard. Provide estimated PulseTCG UK market value in GBP (£) for the predicted ACE grade.

5. SUBMISSION RECOMMENDATION:
- Give a verdict ("Worth Sending", "Borderline", or "Not Worth Sending") comparing potential slab value increase against grading and shipping costs.

Provide a detailed condition analysis matching this exact JSON structure:
{
  "cardIdentification": {
    "cardName": "...",
    "setName": "...",
    "cardNumber": "..."
  },
  "companyPredictions": {
    "PSA": {
      "predictedGrade": "PSA 9",
      "reasoning": "...",
      "pulseTcgUkValue": "£00.00"
    },
    "BGS": {
      "predictedGrade": "9.5",
      "estimatedSubgrades": {
        "centering": "9.5",
        "corners": "9.5",
        "edges": "9.0",
        "surface": "10"
      },
      "reasoning": "...",
      "pulseTcgUkValue": "£00.00"
    },
    "ACE": {
      "predictedGrade": "ACE 9",
      "reasoning": "...",
      "pulseTcgUkValue": "£00.00"
    }
  },
  "subgrades": {
    "centeringFront": "Exact mm measurements and ratio",
    "centeringBack": "Exact mm measurements and ratio",
    "cornersFlaws": ["List specific micro-flaws detected under blue-light/IR simulation"],
    "edgesFlaws": ["List specific edge chipping, silvering, or rough cuts detected"]
  },
  "submissionRecommendation": {
    "worthGrading": true,
    "recommendedCompany": "PSA",
    "verdict": "Worth Sending",
    "summary": "..."
  }
}
`;

    const response = await generateWithRetry({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Analyze these front and back trading card images, identify the card, and provide the precise forensic grade report, PulseTCG UK values, and recommendation in JSON format." },
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
