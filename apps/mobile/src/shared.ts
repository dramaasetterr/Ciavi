/** Pipeline stages for the seller journey */
export const PIPELINE_STAGES = [
  "prep_your_home",
  "price_it",
  "create_listing",
  "manage_showings",
  "review_offers",
  "close_the_deal",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  prep_your_home: "Prep Your Home",
  price_it: "Price It",
  create_listing: "Create Your Listing",
  manage_showings: "Manage Showings",
  review_offers: "Review Offers",
  close_the_deal: "Close the Deal",
};

/** User profile */
export type PlanType = "free" | "seller_pro" | "full_service";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  current_stage: PipelineStage;
  plan: PlanType;
  created_at: string;
  updated_at: string;
}

/** Property listing (matches DB schema) */
export interface PropertyListing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lot_size?: number;
  year_built?: number;
  property_type: PropertyType;
  hoa: boolean;
  hoa_fee?: number;
  features?: string;
  status: ListingStatus;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export const PROPERTY_TYPES = [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi_family: "Multi-Family",
};

export type ListingStatus = "draft" | "active" | "pending" | "sold";

export interface ListingInput {
  address: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year_built: number;
  property_type: PropertyType;
  hoa: boolean;
  hoa_fee?: number;
  features?: string;
  title: string;
  description: string;
  photos: string[];
  price?: number;
}

export interface Listing {
  id: string;
  user_id: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year_built: number;
  property_type: PropertyType;
  hoa: boolean;
  hoa_fee?: number;
  lot_size?: number;
  features?: string;
  title: string;
  description: string;
  photos: string[];
  price: number;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

/** Document types */
export const DOCUMENT_TYPES = [
  "sellers_disclosure",
  "purchase_agreement",
  "counter_offer",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  sellers_disclosure: "Seller's Disclosure Form",
  purchase_agreement: "Purchase Agreement Template",
  counter_offer: "Counter-Offer Template",
};

export const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  sellers_disclosure:
    "Disclose known property conditions as required by state law",
  purchase_agreement:
    "Standard purchase agreement customized for your property",
  counter_offer: "Respond to buyer offers with your terms",
};

export const SUPPORTED_STATES = [
  { value: "NY", label: "New York" },
  { value: "NJ", label: "New Jersey" },
  { value: "CT", label: "Connecticut" },
  { value: "FL", label: "Florida" },
  { value: "TX", label: "Texas" },
  { value: "CA", label: "California" },
] as const;

export type SupportedState = (typeof SUPPORTED_STATES)[number]["value"];

export interface Document {
  id: string;
  user_id: string;
  listing_id: string | null;
  document_type: DocumentType;
  state: string;
  title: string;
  content: string;
  html_content: string;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Pricing types */
export type PropertyCondition = "Excellent" | "Good" | "Fair" | "Needs Work";
export type PriceType = "sell_fast" | "recommended" | "maximize";

export type PoolType =
  | "none"
  | "above_ground"
  | "in_ground"
  | "saltwater"
  | "heated"
  | "saltwater_heated"
  | "infinity"
  | "indoor";

/** Pool features that can be combined (e.g. an in-ground pool that is both saltwater and heated) */
export const POOL_FEATURES = [
  "saltwater",
  "heated",
  "infinity_edge",
  "indoor",
] as const;
export type PoolFeature = (typeof POOL_FEATURES)[number];

export const PREMIUM_FINISHES = [
  "marble_countertops",
  "granite_countertops",
  "quartz_countertops",
  "hardwood_floors",
  "heated_floors",
  "custom_millwork",
  "chef_kitchen",
  "smart_home",
  "wine_cellar",
  "home_theater",
  "sauna",
  "gym",
  "elevator",
  "vaulted_ceilings",
  "skylights",
  "floor_to_ceiling_windows",
  "fireplace",
  "butler_pantry",
  "walk_in_closets",
  "designer_bathrooms",
] as const;
export type PremiumFinish = (typeof PREMIUM_FINISHES)[number];

export const OUTDOOR_FEATURES = [
  "fire_pit",
  "outdoor_kitchen",
  "bbq_patio",
  "covered_patio",
  "deck",
  "pergola",
  "gazebo",
  "koi_pond",
  "water_feature",
  "landscape_lighting",
  "sprinkler_system",
  "playground",
  "sport_court",
  "tennis_court",
  "fenced_yard",
  "gated",
  "mountain_view",
  "water_view",
  "city_view",
  "privacy_trees",
] as const;
export type OutdoorFeature = (typeof OUTDOOR_FEATURES)[number];

export interface PricingInput {
  address: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  year_built: number;
  condition: PropertyCondition;
  property_type?: PropertyType;
  features?: string;
  lot_size_sqft?: number;
  garage_spaces?: number;
  parking_spaces?: number;
  pool_type?: PoolType;
  pool_has_spa?: boolean;

  /** Combinable pool features (saltwater + heated + ...) — supplements pool_type */
  pool_features?: PoolFeature[];
  finished_basement_sqft?: number;
  basement_is_adu?: boolean;
  premium_finishes?: PremiumFinish[];
  outdoor_features?: OutdoorFeature[];
  recent_appraisal_value?: number;
  recent_appraisal_date?: string;
  photos?: string[];
}

export interface PricingResult {
  recommended_price: number;
  sell_fast_price: number;
  maximize_price: number;
  reasoning: string[];
  summary?: string;
  comps?: string[];
}

/** Showing types */
export type ShowingStatus = "confirmed" | "cancelled" | "completed";

export interface ShowingAvailability {
  id: string;
  user_id: string;
  listing_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  created_at: string;
}

export interface Showing {
  id: string;
  listing_id: string;
  seller_id: string;
  availability_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  showing_date: string;
  showing_time_start: string;
  showing_time_end: string;
  status: ShowingStatus;
  created_at: string;
  updated_at: string;
}

export interface BookShowingInput {
  listing_id: string;
  slot_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
}

/** Offer types */
export const FINANCING_TYPES = ["cash", "conventional", "fha", "va"] as const;
export type FinancingType = (typeof FINANCING_TYPES)[number];

export interface OfferInput {
  offered_price: number;
  financing_type: FinancingType;
  down_payment_pct?: number;
  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  closing_date?: string;
  seller_concessions?: string;
  notes?: string;
}

export interface CounterOffer {
  suggested_price: number;
  suggested_changes: string[];
  reasoning: string;
}

export interface OfferAnalysis {
  score: number;
  score_label: string;
  summary: string;
  red_flags: string[];
  counter_offer: CounterOffer;
}

export interface Offer {
  id: string;
  user_id: string;
  listing_id: string;
  offered_price: number;
  financing_type: FinancingType;
  down_payment_pct?: number;
  inspection_contingency: boolean;
  appraisal_contingency: boolean;
  closing_date?: string;
  seller_concessions?: string;
  notes?: string;
  score?: number;
  score_label?: string;
  summary?: string;
  red_flags?: string[];
  counter_suggested_price?: number;
  counter_suggested_changes?: string[];
  counter_reasoning?: string;
  created_at: string;
  updated_at: string;
}

/** Closing types */
export const CLOSING_STEPS = [
  { key: "accept_offer", label: "Accept an Offer", order: 1 },
  { key: "hire_attorney", label: "Hire a Real Estate Attorney", order: 2 },
  { key: "order_title_search", label: "Order Title Search", order: 3 },
  { key: "schedule_inspection", label: "Schedule Home Inspection", order: 4 },
  { key: "appraisal_completed", label: "Appraisal Completed", order: 5 },
  { key: "review_closing_disclosure", label: "Review Closing Disclosure", order: 6 },
  { key: "final_walkthrough", label: "Final Walkthrough", order: 7 },
  { key: "sign_closing_documents", label: "Sign Closing Documents", order: 8 },
  { key: "transfer_keys", label: "Transfer Keys", order: 9 },
] as const;

export type ClosingStepKey = (typeof CLOSING_STEPS)[number]["key"];

export interface ClosingChecklistItem {
  id: string;
  user_id: string;
  listing_id: string;
  step_key: string;
  step_label: string;
  completed: boolean;
  completed_at: string | null;
  step_order: number;
  created_at: string;
}

export interface CustomCost {
  label: string;
  amount: number;
}

export interface ClosingCalculator {
  id: string;
  user_id: string;
  listing_id: string;
  sale_price: number;
  attorney_fees: number;
  title_fees: number;
  transfer_tax_pct: number;
  recording_fees: number;
  seller_concessions: number;
  custom_costs: CustomCost[];
  created_at: string;
  updated_at: string;
}

export interface ClosingGuideStep {
  step: string;
  explanation: string;
  timeline: string;
  seller_action: string;
}

export interface ClosingGuide {
  id: string;
  user_id: string;
  listing_id: string;
  state: string;
  guide_content: ClosingGuideStep[];
  created_at: string;
}
