import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Enable CORS for your Shopify store
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { frontBase64, backBase64 } = req.body;

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({ error: 'Both front and back images are required.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const gradingSystemInstruction = `
You are an elite, hyper-precise trading card authentication and grading AI equipped with advanced computer-vision simulation capabilities, including optical millimeter border measurement, simulated infrared (IR) surface scattering, and blue-light spectrum filtering.

Analyze the front and back images with absolute forensic precision and return valid JSON only.

1. EXACT MILLIMETER CENTERING MEASUREMENT (100% Precision):
- Mathematically measure the exact border widths in millimeters (or fractional ratios) for Top, Bottom, Left, and Right on both the front and back.
- Example format: Front: Left 2.5mm / Right 2.0mm (55/45), Top 2.0mm / Bottom 2.0mm (50/50).
- Apply strict numerical ratios to determine centering grades.

2. SIMULATED INFRARED & BLUE-LIGHT SURFACE/EDGE/CORNER ANALYSIS:
- Simulate Infrared (IR) filtering across the card surface to detect heat signatures of micro-creases, subsurface indentations, pressure dents, and foil warping that are invisible under normal lighting.
- Simulate Blue-Light spectrum filtering to isolate surface gloss integrity, hairline scratches, print lines, roller marks, and microscopic corner fraying or edge whitening.
- Document any detected anomalies in the flaw arrays.

3. COMPANY-SPECIFIC GRADING STANDARDS:
- BECKETT (BGS): Extremely strict and rigid. Enforces strict subgrade mathematical limits. Zero tolerance for flaws found via IR/blue-light inspection.
- PSA: Accurate, slightly more forgiving on minor back-surface or centering variances if the front presentation is pristine.
- ACE GRADING: Collector-friendly, slightly more lenient on minor factory quirks while rewarding clean eye appeal.

Output strict JSON structure matching this exact schema:
{
  "companyPredictions": {
    "PSA": { "predictedGrade": "...", "reasoning": "..." },
    "BGS": { 
      "predictedGrade": "...", 
      "estimatedSubgrades": { "centering": "...", "corners": "...", "edges": "...", "surface": "..." },
      "reasoning": "..." 
    },
    "ACE": { "predictedGrade": "...", "reasoning": "..." }
  },
  "subgrades": {
    "centeringFront": "Exact mm measurements and ratio (e.g., Left 2.0mm / Right 2.5mm - 55/45)",
    "centeringBack": "Exact mm measurements and ratio",
    "cornersFlaws": ["List specific micro-flaws detected under blue-light/IR simulation"],
    "edgesFlaws": ["List specific edge chipping, silvering, or rough cuts detected"]
  }
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Analyze these front and back trading card images and provide the precise forensic grade report in JSON format.' },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: frontBase64
              }
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: backBase64
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: gradingSystemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const rawText = response.text();
    const parsedData = JSON.parse(rawText);

    return res.status(200).json(parsedData);

  } catch (err) {
    console.error('Backend grading error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error during card evaluation.' });
  }
}X
