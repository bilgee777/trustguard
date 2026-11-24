import brandsData from '@shared/engine/brands.json';

export interface Brand {
  name: string;
  /** Words that refer to the brand in message text (matched on word boundaries). */
  keywords: string[];
  /** Official registrable domains. Subdomains of these are treated as official. */
  domains: string[];
}

/**
 * A curated, intentionally small list of frequently impersonated organisations, shared with
 * the C# engine. It is a heuristic seed, not an allow-list of "safe" sites: an official
 * domain only removes the look-alike warnings, it never makes a message safe by itself.
 */
export const BRANDS: Brand[] = brandsData.brands;

/** Brand tokens used for look-alike domain detection (multi-word keywords collapsed). */
export const BRAND_TOKENS: { brand: Brand; token: string }[] = BRANDS.flatMap((brand) =>
  [...new Set(brand.keywords.map((k) => k.replace(/\s+/g, '')))].map((token) => ({ brand, token })),
);

export function isOfficialHost(host: string, brand: Brand): boolean {
  return brand.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function findOfficialBrand(host: string): Brand | null {
  return BRANDS.find((brand) => isOfficialHost(host, brand)) ?? null;
}
