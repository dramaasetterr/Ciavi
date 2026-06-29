import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { json, OPTIONS } from "../_cors";

export { OPTIONS };

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
}

const anthropic = new Anthropic();

type PropertyLookupResult = {
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  year_built: number;
  lot_size_sqft?: number;
  property_type?: "single_family" | "condo" | "townhouse" | "multi_family";
};

const FALLBACK: PropertyLookupResult = {
  sqft: 1800,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1995,
};

function mapRentCastPropertyType(t: unknown): PropertyLookupResult["property_type"] {
  if (typeof t !== "string") return undefined;
  const s = t.toLowerCase();
  if (s.includes("single")) return "single_family";
  if (s.includes("condo")) return "condo";
  if (s.includes("town")) return "townhouse";
  if (s.includes("multi") || s.includes("duplex") || s.includes("triplex")) return "multi_family";
  return undefined;
}

function sanitize(r: Partial<PropertyLookupResult>): PropertyLookupResult | null {
  const sqft = Math.round(Number(r.sqft));
  const bedrooms = Math.round(Number(r.bedrooms));
  const bathrooms = Number(r.bathrooms);
  const year_built = Math.round(Number(r.year_built));

  if (
    !Number.isFinite(sqft) || sqft < 200 || sqft > 20000 ||
    !Number.isFinite(bedrooms) || bedrooms < 0 || bedrooms > 20 ||
    !Number.isFinite(bathrooms) || bathrooms < 0 || bathrooms > 20 ||
    !Number.isFinite(year_built) || year_built < 1700 || year_built > new Date().getFullYear()
  ) {
    return null;
  }

  const result: PropertyLookupResult = { sqft, bedrooms, bathrooms, year_built };

  const lot = Number(r.lot_size_sqft);
  if (Number.isFinite(lot) && lot > 100 && lot < 50_000_000) {
    result.lot_size_sqft = Math.round(lot);
  }

  if (r.property_type) result.property_type = r.property_type;

  return result;
}

async function lookupRentCast(address: string): Promise<PropertyLookupResult | null> {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) return null;

  try {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": key, Accept: "application/json" },
      // RentCast occasionally stalls; cap the wait so the user isn't stuck.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const payload = await res.json();
    const record = Array.isArray(payload) ? payload[0] : payload;
    if (!record || typeof record !== "object") return null;

    return sanitize({
      sqft: record.squareFootage,
      bedrooms: record.bedrooms,
      bathrooms: record.bathrooms,
      year_built: record.yearBuilt,
      lot_size_sqft: record.lotSize,
      property_type: mapRentCastPropertyType(record.propertyType),
    });
  } catch {
    return null;
  }
}

async function lookupLLM(address: string): Promise<PropertyLookupResult | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a US residential real estate expert. Given a property address, estimate the most likely property details based on the neighborhood, region, typical housing stock, and public data patterns for that area.

Address: ${address.trim()}

Return a JSON object with exactly this structure:
{
  "sqft": <number - estimated living area in square feet, typical for this neighborhood>,
  "bedrooms": <number - estimated bedroom count>,
  "bathrooms": <number - estimated bathroom count>,
  "year_built": <number - estimated year the home was built, based on typical construction era for the area>
}

Use your knowledge of US housing patterns:
- Consider the city, state, and neighborhood to infer typical home sizes and ages.
- Suburban addresses tend toward 3-4 bed / 2-3 bath; urban condos toward 1-2 bed / 1 bath.
- Older East Coast neighborhoods often have homes from the early 1900s; Sun Belt suburbs from the 1990s-2010s.
- Provide reasonable middle-of-the-road estimates — these are starting defaults the user will adjust.

Return ONLY valid JSON, no markdown or other text.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = JSON.parse(textBlock.text);
    return sanitize(parsed);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== "string" || address.trim().length === 0) {
      return json({ error: "A valid address string is required" }, 400);
    }

    const trimmed = address.trim();

    const fromRentCast = await lookupRentCast(trimmed);
    if (fromRentCast) return json(fromRentCast);

    const fromLLM = await lookupLLM(trimmed);
    if (fromLLM) return json(fromLLM);

    return json(FALLBACK);
  } catch {
    return json(
      { error: "Failed to look up property details. Please try again or enter them manually." },
      500
    );
  }
}
