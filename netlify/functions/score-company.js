exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const company = JSON.parse(event.body || "{}");

    if (!company.name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Company name is required" })
      };
    }

    const prompt = `
You are evaluating sales prospects for a commercial printing company.

Score this company from 0 to 100 based on how attractive it appears as a potential commercial printing customer.

The printing company sells:
- brochures
- flyers
- catalogs and booklets
- direct mail
- roll labels
- product labels
- folders
- signage
- window graphics
- banners
- menus
- point-of-sale materials
- marketing collateral
- multi-location marketing materials

Favor companies that appear to have:
- multiple locations
- regional or national operations
- franchise or dealer networks
- substantial marketing activity
- recurring print needs
- distributed sales or marketing teams
- physical locations
- product packaging or label needs
- recurring signage or collateral needs

Scoring guide:
90-100 = exceptional prospect
80-89 = very strong prospect
70-79 = good prospect
50-69 = average prospect
Below 50 = weaker prospect

Company:
Name: ${company.name || ""}
Website: ${company.website || ""}
Industry: ${company.industry || ""}
Location: ${company.location || ""}
Products: ${company.products || ""}
Opportunity Summary: ${company.opportunity_summary || ""}
Notes: ${company.notes || ""}

Return ONLY valid JSON in exactly this format:

{
  "score": 85,
  "reason": "One short sentence explaining why this company received the score."
}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Gemini request failed",
          details: errorText
        })
      };
    }

    const data = await response.json();

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini returned no score.");
    }

    const result = JSON.parse(text);

    let score = Number(result.score);

    if (!Number.isFinite(score)) {
      throw new Error("Gemini returned an invalid score.");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        score,
        reason: result.reason || ""
      })
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Unable to score company."
      })
    };
  }
};
