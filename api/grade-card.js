import { GoogleGenAI, Type } from "@google/genai";

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    subgrades: {
      type: Type.OBJECT,
      properties: {
        centeringFront: { type: Type.STRING, description: "Front L/R and T/B ratios e.g. 55/45" },
        centeringBack: { type: Type.STRING, description: "Back L/R and T/B ratios e.g. 60/40" },
        cornersFlaws: { type: Type.ARRAY, items: { type: Type.STRING } },
        edgesFlaws: { type: Type.ARRAY, items: { type: Type.STRING } },
        surfaceFlaws: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["centeringFront", "centeringBack", "cornersFlaws", "edgesFlaws", "surfaceFlaws"]
    },
    companyPredictions: {
      type: Type.OBJECT,
      properties: {
        PSA: {
          type: Type.OBJECT,
          properties: {
            predictedGrade: { type: Type.STRING, description: "e.g. PSA 10 Gem Mint or PSA 9 Mint" },
            is10Likely: { type: Type.BOOLEAN },
            reasoning: { type: Type.STRING }
          },
          required: ["predictedGrade", "is10Likely", "reasoning"]
        },
        BGS: {
          type: Type.OBJECT,
          properties: {
            predictedGrade: { type: Type.STRING, description: "e.g. BGS 9.5 Gem Mint or BGS 10 Pristine" },
            is10Likely: { type: Type.BOOLEAN },
            estimatedSubgrades: {
              type: Type.OBJECT,
              properties: {
                centering: { type: Type.NUMBER },
                corners: { type: Type.NUMBER },
                edges: { type: Type.NUMBER },
                surface: { type: Type.NUMBER }
              },
              required: ["centering", "corners", "edges", "surface"]
            },
            reasoning: { type: Type.STRING }
          },
          required: ["predictedGrade", "is10Likely", "estimatedSubgrades", "reasoning"]
        },
        ACE: {
          type: Type.OBJECT,
          properties: {
            predictedGrade: { type: Type.STRING, description: "e.g. ACE 10 Gem Mint or ACE 9" },
            is10Likely: { type: Type.BOOLEAN },
            reasoning: { type: Type.STRING }
          },
          required: ["predictedGrade", "is10Likely", "reasoning"]
        }
      },
      required: ["PSA", "BGS", "ACE"]
    }
  },
  required: ["subgrades", "companyPredictions"]
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { frontBase64, backBase64 } = req.body;

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({ error: 'Both Front and Back card images are required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY environment variable on server.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are an expert trading card condition evaluator. Analyze the provided FRONT and BACK photos of this trading card rip till you hit.

Strictly evaluate the physical condition and provide individual predictions for THREE grading companies:
1. PSA: PSA 10 allows front centering up to 55/45-60/40 and back up to 75/25. No edge chipping or corner wear permitted.
2. BGS (Beckett): Assign subgrades (Centering, Corners, Edges, Surface). BGS 10 Pristine requires near 50/50 centering and zero flaws. BGS 9.5 Gem Mint permits minor off-centering (~55/45).
3. ACE Grading: Assess visual centering, edge silvering/whitening, and corner sharpness under high visual inspection standards.

Return JSON according to the required schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: frontBase64.replace(/^data:image\/\w+;base64,/, "") } },
          { inlineData: { mimeType: 'image/jpeg', data: backBase64.replace(/^data:image\/\w+;base64,/, "") } }
        ]}
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    const parsedData = JSON.parse(response.text);
    return res.status(200).json(parsedData);

  } catch (err) {
    console.error('Card Assessment Error:', err);
    return res.status(500).json({ error: 'Grading processing failed: ' + err.message });
  }
}
