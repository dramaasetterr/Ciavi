import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { json, OPTIONS } from "../_cors";

export { OPTIONS };

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
}

const anthropic = new Anthropic();

interface DescriptionRequest {
  address: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year_built: number;
  property_type: string;
  hoa: boolean;
  condition?: string;
  selected_price?: number;
  features?: string;
}

function generateFallbackDescription(body: DescriptionRequest): {
  title: string;
  description: string;
  source: "fallback";
} {
  const { address, bedrooms, bathrooms, sqft, year_built, property_type, hoa, condition, features } = body;

  const propertyTypeLabel = property_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const title = `${bedrooms} Bed, ${bathrooms} Bath ${propertyTypeLabel} — ${sqft.toLocaleString()} Sqft`;

  const lines = [
    `${bedrooms}-bedroom, ${bathrooms}-bath ${propertyTypeLabel.toLowerCase()} at ${address} with ${sqft.toLocaleString()} square feet of living space, built in ${year_built}.`,
    condition ? `Condition: ${condition}.` : "",
    features && features.trim() ? `Features include: ${features.trim().replace(/\.\s*$/, "")}.` : "",
    hoa ? "Located in an HOA community." : "",
    "For sale by owner — contact the seller directly through Chiavi to ask questions or schedule a showing.",
  ].filter(Boolean);

  return { title, description: lines.join("\n\n"), source: "fallback" };
}

export async function POST(request: NextRequest) {
  try {
    const body: DescriptionRequest = await request.json();

    const {
      address,
      bedrooms,
      bathrooms,
      sqft,
      year_built,
      property_type,
      hoa,
      condition,
      selected_price,
      features,
    } = body;

    if (!address || !bedrooms || !bathrooms || !sqft || !year_built) {
      return json({ error: "Property details are required" }, 400);
    }

    const propertyTypeLabel = property_type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const age = new Date().getFullYear() - year_built;

    let result: { title: string; description: string; source?: string };

    try {
      const message = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 4000,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: `Write a real estate listing description for a For Sale By Owner property. Buyers scanning listings want facts, not stories — write like the best Zillow listings: specific, feature-dense, and easy to scan.

Property Details:
- Address: ${address}
- Type: ${propertyTypeLabel}
- Bedrooms: ${bedrooms}
- Bathrooms: ${bathrooms}
- Square Footage: ${sqft.toLocaleString()}
- Year Built: ${year_built} (${age} years old)
- HOA: ${hoa ? "Yes" : "No"}
${condition ? `- Condition: ${condition}` : ""}
${features ? `- Features & Upgrades: ${features}` : ""}

Rules:
1. TITLE: A specific, factual headline under 80 characters that leads with the property's strongest concrete selling point (e.g. "Renovated 4BR Colonial with Heated Saltwater Pool on Half an Acre"). No "Welcome Home", no "Dream Home", no exclamation points.
2. DESCRIPTION: 2-3 short paragraphs, separated by \\n\\n:
   - Paragraph 1: what the property IS — beds, baths, square footage, type, year built, condition — plus its 2-3 strongest features. Every sentence must carry a concrete fact.
   - Paragraph 2: the remaining features and practical details (kitchen/bath finishes, systems and updates with years if known, lot, garage/parking, pool, outdoor spaces, basement, HOA). Name specific features from the list above — do not generalize them away.
   - Optional short final paragraph: one or two sentences max — sold directly by the owner, contact to schedule a showing.
3. NO narrative or lifestyle storytelling: never "imagine", "picture yourself", "your next chapter", "lifestyle", "oasis", "boasts", "nestled". No emotional hooks. No urgency language ("won't last", "act now").
4. Adjectives only when they carry information ("granite countertops", "fenced yard" — good; "stunning", "breathtaking" — banned).
5. Do NOT mention the price.
${selected_price ? "" : ""}
Return a JSON object with exactly this structure:
{
  "title": "<headline, max 80 characters>",
  "description": "<2-3 paragraphs with \\n\\n between them>"
}

Return ONLY valid JSON, no markdown or other text.`,
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("AI response did not contain a text block");
      }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
      }

      try {
        result = JSON.parse(cleaned);
      } catch {
        throw new Error("Failed to parse AI JSON response");
      }
      result.source = "ai";
    } catch (aiError) {
      result = generateFallbackDescription(body);
    }

    return json(result);
  } catch {
    return json(
      { error: "An unexpected error occurred. Please try again." },
      500
    );
  }
}
