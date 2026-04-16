export type Category = 'sd' | 'cfexpress_a' | 'cfexpress_b';
export type VideoSpeedClass = 'V90' | 'V60' | 'V30' | 'unknown';
export type VpgClass = 'VPG400' | 'VPG200' | 'non_vpg' | 'unknown';

export type ParsedBhProduct = {
  bhNumber: string;
  category: Category;
  brand: string;
  name: string;
  capacityGb: number | null;
  model: string | null;
  url: string | null;
  videoSpeedClass: VideoSpeedClass;
  vpgClass: VpgClass;
  isKit: boolean;
  kitSize: number;
  regularPrice: number | null;
  salePrice: number | null;
  isOnSale: boolean;
  stockStatus: 'in_stock' | 'backordered' | 'out_of_stock' | 'unknown';
};

const ALLOWED_BRANDS = new Set([
  'SanDisk',
  'ProGrade Digital',
  'Lexar',
  'Angelbird',
  'Exascend',
  'Sony',
  'Wise Advanced',
]);

function normalizeText(input: string | null | undefined): string {
  return (input ?? '').replace(/\s+/g, ' ').trim();
}

function parseMoney(text: string): number | null {
  const m = text.replace(/,/g, '').match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  return m ? Number(m[1]) : null;
}

function inferCategory(text: string): Category | null {
  const t = text.toLowerCase();
  if (t.includes('cfexpress') && t.includes('type a')) return 'cfexpress_a';
  if (t.includes('cfexpress') && t.includes('type b')) return 'cfexpress_b';
  if (
    t.includes('sdxc') ||
    t.includes('sdhc') ||
    /\bsd\b/i.test(text) ||
    t.includes('uhs-ii')
  ) {
    return 'sd';
  }
  return null;
}

function extractCapacityGb(text: string): number | null {
  const tb = text.match(/(\d+(?:\.\d+)?)\s*tb/i);
  if (tb) return Math.round(Number(tb[1]) * 1000);
  const gb = text.match(/(\d+)\s*gb/i);
  if (gb) return Number(gb[1]);
  return null;
}

function extractVideoSpeedClass(text: string): VideoSpeedClass {
  if (/\bV90\b/i.test(text)) return 'V90';
  if (/\bV60\b/i.test(text)) return 'V60';
  if (/\bV30\b/i.test(text)) return 'V30';
  return 'unknown';
}

function extractVpgClass(text: string): VpgClass {
  if (/VPG[- ]?400/i.test(text)) return 'VPG400';
  if (/VPG[- ]?200/i.test(text)) return 'VPG200';
  if (/cfexpress/i.test(text)) return 'non_vpg';
  return 'unknown';
}

function detectKit(name: string): { isKit: boolean; kitSize: number } {
  const t = name.toLowerCase();
  const pack = t.match(/(\d+)[ -]pack/);
  if (pack) return { isKit: true, kitSize: Number(pack[1]) };
  if (/\bkit\b/i.test(name)) return { isKit: true, kitSize: 2 };
  if (/bundles?\s+two/i.test(t)) return { isKit: true, kitSize: 2 };
  if (/bundles?\s+three/i.test(t)) return { isKit: true, kitSize: 3 };
  return { isKit: false, kitSize: 1 };
}

function detectBrand(name: string): string | null {
  for (const brand of ALLOWED_BRANDS) {
    if (name.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return null;
}

function detectStock(text: string): ParsedBhProduct['stockStatus'] {
  const t = text.toLowerCase();
  if (t.includes('backorder')) return 'backordered';
  if (t.includes('out of stock') || t.includes('temporarily unavailable'))
    return 'out_of_stock';
  if (t.includes('in stock') || t.includes('available')) return 'in_stock';
  return 'unknown';
}

function firstAttr(el: Element, attrs: string[]): string | null {
  for (const attr of attrs) {
    const v = el.getAttribute(attr);
    if (v) return v;
  }
  return null;
}

function firstText(el: ParentNode, selectors: string[]): string {
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    const txt = normalizeText(node?.textContent);
    if (txt) return txt;
  }
  return '';
}

function parseOneCard(card: Element): ParsedBhProduct | null {
  const name =
    firstText(card, [
      '[data-selenium="miniProductPageProductName"]',
      'h3',
      'h2',
      'a[data-selenium*="productName"]',
      'a[href*="/c/product/"]',
    ]) || normalizeText(card.textContent);

  if (!name) return null;

  const brand = detectBrand(name);
  if (!brand) return null;

  const category = inferCategory(name);
  if (!category) return null;

  const { isKit, kitSize } = detectKit(name);

  const urlNode = card.querySelector(
    'a[href*="/c/product/"]'
  ) as HTMLAnchorElement | null;
  const url = urlNode?.href ?? null;

  const bhText = normalizeText(card.textContent);
  const bhMatch = bhText.match(/BH\s*#\s*([A-Z0-9-]+)/i);
  const bhNumber =
    bhMatch?.[1] ?? firstAttr(card, ['data-item-id', 'data-sku']) ?? '';

  const modelMatch = bhText.match(/MFR\s*#\s*([A-Z0-9._/-]+)/i);
  const model = modelMatch?.[1] ?? null;

  const regularText = firstText(card, [
    '[data-selenium="pricingWas"]',
    '.price_2Dl9q del',
    'del',
  ]);
  const currentText = firstText(card, [
    '[data-selenium="uppedDecimalPriceFirst"]',
    '[data-selenium="pricingPrice"]',
    '.price_2Dl9q',
    '.price',
  ]);

  const regularPrice = parseMoney(regularText);
  const currentPrice = parseMoney(currentText);

  const salePrice = currentPrice;
  const isOnSale =
    regularPrice != null && salePrice != null
      ? salePrice < regularPrice
      : false;

  const combinedText = normalizeText(card.textContent);

  return {
    bhNumber,
    category,
    brand,
    name,
    capacityGb: extractCapacityGb(name),
    model,
    url,
    videoSpeedClass: extractVideoSpeedClass(combinedText),
    vpgClass: extractVpgClass(combinedText),
    isKit,
    kitSize,
    regularPrice,
    salePrice,
    isOnSale,
    stockStatus: detectStock(combinedText),
  };
}

export default function parseBhSnapshot(html: string): ParsedBhProduct[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const cardSelectors = [
    '[data-selenium="miniProductPage"]',
    '[data-selenium="productMini"]',
    'article',
    '.item',
    '.product',
  ];

  const seen = new Set<string>();
  const out: ParsedBhProduct[] = [];

  for (const selector of cardSelectors) {
    const nodes = Array.from(doc.querySelectorAll(selector));
    for (const node of nodes) {
      const parsed = parseOneCard(node);
      if (!parsed) continue;
      if (!ALLOWED_BRANDS.has(parsed.brand)) continue;
      if (parsed.isKit) continue;
      if (!parsed.bhNumber && !parsed.url) continue;

      const key = parsed.bhNumber || parsed.url || parsed.name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(parsed);
    }
    if (out.length > 0) break;
  }

  return out;
}
