import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Retry wrapper to handle any temporary high-demand (503) spikes gracefully
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

    const prompt = `
      You are an expert professional trading card condition evaluator and grader (PSA, BGS, ACE).
      Analyze these two trading card images (Image 1 = Front, Image 2 = Back).
      
      Provide a detailed condition analysis and grade estimations in valid JSON matching this exact structure:
      {
        "companyPredictions": {
          "PSA": {
            "predictedGrade": "PSA 9",
            "reasoning": "Minor off-centering front (60/40), corners sharp."
          },
          "BGS": {
            "predictedGrade": "9.5",
            "estimatedSubgrades": {
              "centering": "9.5",
              "corners": "9.5",
              "edges": "9.0",
              "surface": "10"
            },
            "reasoning": "Slight edge wear on top back border."
          },
          "ACE": {
            "predictedGrade": "ACE 9",
            "reasoning": "Solid gem mint potential, slight surface print lines."
          }
        },
        "subgrades": {
          "centeringFront": "55/45 Left to Right",
          "centeringBack": "50/50",
          "cornersFlaws": ["Minor whitening top-left back corner"],
          "edgesFlaws": ["Clean"]
        }
      }
    `;

    const response = await generateWithRetry({
      model: "gemini-3.8-flash", 
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
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
        responseMimeType: "application/json"
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
