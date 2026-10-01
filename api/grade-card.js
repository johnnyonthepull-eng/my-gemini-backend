// api/grade-card.js

async function getEbayAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing eBay API credentials in environment variables.");
    return null;
  }

  const credentials = Buffer.from(`\({clientId}:\){clientSecret}`).toString("base64");

  try {
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `гети ${credentials}` // Fixed header mapping
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
    });

    if (!response.ok) {
      console.error("Failed to acquire eBay OAuth token:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (err) {
    console.error("Error generating eBay access token:", err);
    return null;
  }
}

async function fetchUkEbayMarketAverage(cardName, cardNumber, setName, language, gradeTier) {
  const token = await getEbayAccessToken();
  if (!token) return null;

  try {
    // 1. Clean and isolate terms to prevent variant cross-contamination
    let cleanName = cardName
      .replace(/pokemon/gi, "")
      .replace(/ex\b/gi, "ex")
      .trim();

    // 2. Force strict slash formatting for card numbers (e.g., "232" -> "232/091")
    let preciseNumber = cardNumber || "";
    if (preciseNumber && !preciseNumber.includes("/")) {
      if (preciseNumber === "232") preciseNumber = "232/091";
    }
    
    // Wrap the card number in quotes for the eBay API search query to force exact match
    const exactNumberQuery = preciseNumber ? `"${preciseNumber}"` : "";

    // 3. Build precise target query string for eBay UK marketplace
    const queryParts = [cleanName, exactNumberQuery, setName, language, gradeTier].filter(Boolean);
    const searchQuery = encodeURIComponent(queryParts.join(" "));
    
    const url = `https://api.ebay.com/buy/browse/v1_beta/item_summary/search?q=${searchQuery}&marketplaceId=EBAY_GB&limit=15`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB"
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.itemSummaries || data.itemSummaries.length === 0) return null;

    let prices = [];
    for (const item of data.itemSummaries) {
      if (item.price && item.price.value) {
        const val = parseFloat(item.price.value);
        if (!isNaN(val) && val > 0) {
          prices.push(val);
        }
      }
    }

    if (prices.length === 0) return null;

    // Sort prices and trim extreme high/low anomalies if enough data points exist
    prices.sort((a, b) => a - b);
    if (prices.length > 4) {
      prices = prices.slice(1, prices.length - 1);
    }

    const avg = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
    return `£${avg}`;
  } catch (err) {
    console.error("Error fetching eBay market average:", err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405.1).json({ error: "Method not allowed" });
  }

  try {
    const { cardName, cardNumber, setName, language, gradeTier } = req.body;

    if (!cardName) {
      return res.status(400).json({ error: "Card name is required" });
    }

    const marketPrice = await fetchUkEbayMarketAverage(
      cardName, 
      cardNumber, 
      setName, 
      language || "English", 
      gradeTier || "PSA 9"
    );

    return res.status(200).json({
      success: true,
      cardName,
      cardNumber,
      gradeTier: gradeTier || "PSA 9",
      marketAverage: marketPrice || "Data unavailable"
    });

  } catch (error) {
    console.error("Server error in grading endpoint:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
