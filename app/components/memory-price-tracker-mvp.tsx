'use client';

import React, { useEffect, useMemo, useState } from 'react';
import parseBhSnapshot from '../import/parser';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Bell,
  Package2,
  Search,
  Tag,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';

type Category = 'sd' | 'cfexpress_a' | 'cfexpress_b';
type VideoSpeedClass = 'V90' | 'V60' | 'V30' | 'unknown';
type VpgClass =
  | 'VPG1600'
  | 'VPG800'
  | 'VPG400'
  | 'VPG200'
  | 'non_vpg'
  | 'unknown';
type Granularity = 'weekly' | 'monthly' | 'quarterly';
type MainTab = 'tracked' | 'import';
type VpgFacet =
  | 'VPG1600'
  | 'VPG800'
  | 'VPG400'
  | 'VPG200'
  | 'all'
  | 'unknown';

type Product = {
  id: string;
  bhNumber: string;
  category: Category;
  brand: string;
  name: string;
  capacityGb: number;
  model: string;
  url: string;
  videoSpeedClass: VideoSpeedClass;
  vpgClass: VpgClass;
  vpgFacet?: VpgFacet;
  isKit: boolean;
  kitSize: number;
  firstSeenAt: string;
  lastSeenAt: string;
  isNewCandidate: boolean;
};

type PriceSnapshot = {
  id: string;
  productId: string;
  capturedAt: string;
  regularPrice: number | null;
  salePrice: number | null;
  currency: 'USD';
  isOnSale: boolean;
  stockStatus: 'in_stock' | 'backordered' | 'out_of_stock';
};

type DiscoveryEvent = {
  id: string;
  productId: string;
  detectedAt: string;
  eventType: 'new_product_detected' | 'new_sale' | 'back_in_stock';
  note?: string;
};

type ProductSummary = Product & {
  latestSnapshot: PriceSnapshot | null;
  previousSnapshot: PriceSnapshot | null;
  effectiveLatestPrice: number | null;
  weeklyDelta: number | null;
  lowestSeenPrice: number | null;
  isNew: boolean;
};

type HistoryRow = {
  capturedAt: string;
  [key: string]: string | number | null;
};

type SavedSnapshotRow = {
  bhNumber: string;
  category: Category;
  brand: string;
  name: string;
  capacityGb: number | null;
  model: string | null;
  url: string | null;
  videoSpeedClass: VideoSpeedClass;
  vpgClass: VpgClass;
  vpgFacet?: VpgFacet;
  isKit: boolean;
  kitSize: number;
  regularPrice: number | null;
  salePrice: number | null;
  isOnSale: boolean;
  stockStatus: 'in_stock' | 'backordered' | 'out_of_stock' | 'unknown';
  capturedAt: string;
  sourceUrl?: string;
  pageTitle?: string;
};

type ImportPayload = {
  html: string;
  sourceUrl?: string;
  pageTitle?: string;
};

type ImportedSnapshotRow = Omit<
  SavedSnapshotRow,
  'capturedAt' | 'sourceUrl' | 'pageTitle'
>;

const allowedBrands = [
  'SanDisk',
  'ProGrade Digital',
  'Lexar',
  'Angelbird',
  'Exascend',
  'Sony',
  'Wise Advanced',
] as const;

const brandColorMap: Record<string, string> = {
  SanDisk: '#2563eb',
  'ProGrade Digital': '#dc2626',
  Lexar: '#f59e0b',
  Angelbird: '#16a34a',
  Exascend: '#9333ea',
  Sony: '#0f172a',
  'Wise Advanced': '#0891b2',
};

const fallbackProducts: Product[] = [
  {
    id: 'p2',
    bhNumber: 'SN256V90',
    category: 'sd',
    brand: 'SanDisk',
    name: 'SanDisk Extreme PRO SDXC UHS-II 256GB V90',
    capacityGb: 256,
    model: 'SDSDXEP-256G-ANCMN',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'V90',
    vpgClass: 'unknown',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p3',
    bhNumber: 'PG256V90',
    category: 'sd',
    brand: 'ProGrade Digital',
    name: 'ProGrade Digital SDXC UHS-II 256GB V90',
    capacityGb: 256,
    model: 'PGSD256GBCKBH',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'V90',
    vpgClass: 'unknown',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p4',
    bhNumber: 'SO256V90',
    category: 'sd',
    brand: 'Sony',
    name: 'Sony TOUGH SDXC UHS-II 256GB V90',
    capacityGb: 256,
    model: 'SF-G256T',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'V90',
    vpgClass: 'unknown',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p6',
    bhNumber: 'AG1TBVPG',
    category: 'cfexpress_a',
    brand: 'Angelbird',
    name: 'Angelbird AV PRO CFexpress Type A 1TB',
    capacityGb: 1000,
    model: 'AVP1T0CFXA',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'unknown',
    vpgClass: 'VPG400',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: true,
  },
  {
    id: 'p7',
    bhNumber: 'EX1TBVPG',
    category: 'cfexpress_a',
    brand: 'Exascend',
    name: 'Exascend Nitro CFexpress Type A 1TB',
    capacityGb: 1000,
    model: 'EXPC1TAA',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'unknown',
    vpgClass: 'VPG400',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p8',
    bhNumber: 'SO1TBVPG',
    category: 'cfexpress_a',
    brand: 'Sony',
    name: 'Sony CFexpress Type A 1TB',
    capacityGb: 1000,
    model: 'CEA-G1000T',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'unknown',
    vpgClass: 'VPG400',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p10',
    bhNumber: 'LE512B200',
    category: 'cfexpress_b',
    brand: 'Lexar',
    name: 'Lexar Professional CFexpress Type B 512GB',
    capacityGb: 512,
    model: 'LCXEXPR512G-RNENJ',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'unknown',
    vpgClass: 'VPG200',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p11',
    bhNumber: 'PG512B200',
    category: 'cfexpress_b',
    brand: 'ProGrade Digital',
    name: 'ProGrade Digital CFexpress Type B 512GB Gold',
    capacityGb: 512,
    model: 'PGB512GBCKBH',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'unknown',
    vpgClass: 'VPG200',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
  {
    id: 'p12',
    bhNumber: 'AG512B200',
    category: 'cfexpress_b',
    brand: 'Angelbird',
    name: 'Angelbird AV PRO CFexpress Type B 512GB',
    capacityGb: 512,
    model: 'AVP512CFXB',
    url: 'https://www.bhphotovideo.com',
    videoSpeedClass: 'unknown',
    vpgClass: 'VPG200',
    isKit: false,
    kitSize: 1,
    firstSeenAt: '2026-01-05',
    lastSeenAt: '2026-03-23',
    isNewCandidate: false,
  },
];

const fallbackSnapshots: PriceSnapshot[] = [
  {
    id: 's1',
    productId: 'p2',
    capturedAt: '2026-01-05',
    regularPrice: 289,
    salePrice: 289,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's2',
    productId: 'p2',
    capturedAt: '2026-02-02',
    regularPrice: 289,
    salePrice: 269,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's3',
    productId: 'p2',
    capturedAt: '2026-03-02',
    regularPrice: 289,
    salePrice: 259,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's4',
    productId: 'p2',
    capturedAt: '2026-03-23',
    regularPrice: 289,
    salePrice: 279,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's5',
    productId: 'p3',
    capturedAt: '2026-01-05',
    regularPrice: 309,
    salePrice: 309,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's6',
    productId: 'p3',
    capturedAt: '2026-02-02',
    regularPrice: 309,
    salePrice: 289,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's7',
    productId: 'p3',
    capturedAt: '2026-03-02',
    regularPrice: 309,
    salePrice: 279,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's8',
    productId: 'p3',
    capturedAt: '2026-03-23',
    regularPrice: 309,
    salePrice: 279,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's9',
    productId: 'p4',
    capturedAt: '2026-01-05',
    regularPrice: 329,
    salePrice: 329,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's10',
    productId: 'p4',
    capturedAt: '2026-02-02',
    regularPrice: 329,
    salePrice: 309,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's11',
    productId: 'p4',
    capturedAt: '2026-03-02',
    regularPrice: 329,
    salePrice: 299,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's12',
    productId: 'p4',
    capturedAt: '2026-03-23',
    regularPrice: 329,
    salePrice: 299,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's13',
    productId: 'p6',
    capturedAt: '2026-01-05',
    regularPrice: 629,
    salePrice: 629,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's14',
    productId: 'p6',
    capturedAt: '2026-02-02',
    regularPrice: 629,
    salePrice: 599,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's15',
    productId: 'p6',
    capturedAt: '2026-03-02',
    regularPrice: 629,
    salePrice: 579,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's16',
    productId: 'p6',
    capturedAt: '2026-03-23',
    regularPrice: 629,
    salePrice: 579,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's17',
    productId: 'p7',
    capturedAt: '2026-01-05',
    regularPrice: 599,
    salePrice: 599,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's18',
    productId: 'p7',
    capturedAt: '2026-02-02',
    regularPrice: 599,
    salePrice: 569,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's19',
    productId: 'p7',
    capturedAt: '2026-03-02',
    regularPrice: 599,
    salePrice: 549,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's20',
    productId: 'p7',
    capturedAt: '2026-03-23',
    regularPrice: 599,
    salePrice: 549,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's21',
    productId: 'p8',
    capturedAt: '2026-01-05',
    regularPrice: 699,
    salePrice: 699,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's22',
    productId: 'p8',
    capturedAt: '2026-02-02',
    regularPrice: 699,
    salePrice: 679,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's23',
    productId: 'p8',
    capturedAt: '2026-03-02',
    regularPrice: 699,
    salePrice: 659,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's24',
    productId: 'p8',
    capturedAt: '2026-03-23',
    regularPrice: 699,
    salePrice: 659,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's25',
    productId: 'p10',
    capturedAt: '2026-01-05',
    regularPrice: 329,
    salePrice: 329,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's26',
    productId: 'p10',
    capturedAt: '2026-02-02',
    regularPrice: 329,
    salePrice: 309,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's27',
    productId: 'p10',
    capturedAt: '2026-03-02',
    regularPrice: 329,
    salePrice: 299,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's28',
    productId: 'p10',
    capturedAt: '2026-03-23',
    regularPrice: 329,
    salePrice: 299,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's29',
    productId: 'p11',
    capturedAt: '2026-01-05',
    regularPrice: 349,
    salePrice: 349,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's30',
    productId: 'p11',
    capturedAt: '2026-02-02',
    regularPrice: 349,
    salePrice: 329,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's31',
    productId: 'p11',
    capturedAt: '2026-03-02',
    regularPrice: 349,
    salePrice: 319,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's32',
    productId: 'p11',
    capturedAt: '2026-03-23',
    regularPrice: 349,
    salePrice: 319,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's33',
    productId: 'p12',
    capturedAt: '2026-01-05',
    regularPrice: 339,
    salePrice: 339,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
  {
    id: 's34',
    productId: 'p12',
    capturedAt: '2026-02-02',
    regularPrice: 339,
    salePrice: 319,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's35',
    productId: 'p12',
    capturedAt: '2026-03-02',
    regularPrice: 339,
    salePrice: 309,
    currency: 'USD',
    isOnSale: true,
    stockStatus: 'in_stock',
  },
  {
    id: 's36',
    productId: 'p12',
    capturedAt: '2026-03-23',
    regularPrice: 309,
    salePrice: 309,
    currency: 'USD',
    isOnSale: false,
    stockStatus: 'in_stock',
  },
];

const fallbackDiscoveryEvents: DiscoveryEvent[] = [
  {
    id: 'e1',
    productId: 'p6',
    detectedAt: '2026-03-05',
    eventType: 'new_product_detected',
  },
];



function downloadExcel(rows: SavedSnapshotRow[]) {
  const exportRows = rows.map((row) => ({
    取得日時: row.capturedAt ? String(row.capturedAt).slice(0, 10) : '',
    ブランド: row.brand,
    カテゴリ:
      row.category === 'sd'
        ? 'SD'
        : row.category === 'cfexpress_a'
        ? 'CFexpress Type A'
        : 'CFexpress Type B',
    容量GB: row.capacityGb ?? '',
    スピードクラス: row.category === 'sd' ? row.videoSpeedClass : '',
    VPG: row.category !== 'sd' ? (row.vpgFacet ?? row.vpgClass ?? '') : '',
    商品名: row.name,
    型番: row.model ?? '',
    BH番号: row.bhNumber,
    セール価格: row.salePrice ?? '',
    通常価格: row.regularPrice ?? '',
    セール中: row.isOnSale ? 'Yes' : 'No',
    在庫: row.stockStatus,
    取得元URL: row.sourceUrl ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'B&H Tracker');

const today = new Date().toISOString().slice(0, 10);
XLSX.writeFile(workbook, `bh-tracker-${today}.xlsx`);
}


function inferVpgFacetFromUrl(url: string | null | undefined): VpgFacet {
  if (!url) return 'unknown';

  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }

  const u = decoded.toLowerCase();

  if (u.includes('vpg-certification') && u.includes('vpg-1600')) {
    return 'VPG1600';
  }

  if (u.includes('vpg-certification') && u.includes('vpg-800')) {
    return 'VPG800';
  }

  if (u.includes('vpg-certification') && u.includes('vpg-400')) {
    return 'VPG400';
  }

  if (u.includes('vpg-certification') && u.includes('vpg-200')) {
    return 'VPG200';
  }

  return 'all';
}

function currency(value: number | null) {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function effectivePrice(snapshot: PriceSnapshot | null) {
  if (!snapshot) return null;
  return snapshot.salePrice ?? snapshot.regularPrice;
}

function quarterLabel(date: Date) {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()} Q${quarter}`;
}

function monthLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function dayLabel(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekLabel(date: Date) {
  const firstDay = new Date(date);
  firstDay.setDate(date.getDate() - date.getDay());
  const month = String(firstDay.getMonth() + 1).padStart(2, '0');
  const day = String(firstDay.getDate()).padStart(2, '0');
  return `${firstDay.getFullYear()}-${month}-${day}`;
}

function bucketKey(dateStr: string, granularity: Granularity) {
  const date = new Date(dateStr);
  switch (granularity) {
    case 'weekly':
      return weekLabel(date);
    case 'monthly':
      return monthLabel(date);
    case 'quarterly':
      return quarterLabel(date);
  }
}

function categoryLabel(category: Category) {
  if (category === 'sd') return 'SD';
  if (category === 'cfexpress_a') return 'CFexpress Type A';
  return 'CFexpress Type B';
}

function brandColor(brand: string) {
  return brandColorMap[brand] ?? '#64748b';
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}



function getDisplayVpg(row: { vpgFacet?: VpgFacet; vpgClass?: VpgClass }): VpgClass {
  if (row.vpgFacet === 'VPG1600') return 'VPG1600';
  if (row.vpgFacet === 'VPG800') return 'VPG800';
  if (row.vpgFacet === 'VPG400') return 'VPG400';
  if (row.vpgFacet === 'VPG200') return 'VPG200';

  if (row.vpgClass === 'VPG1600') return 'VPG1600';
  if (row.vpgClass === 'VPG800') return 'VPG800';
  if (row.vpgClass === 'VPG400') return 'VPG400';
  if (row.vpgClass === 'VPG200') return 'VPG200';

  return 'non_vpg';
}

function specLabel(product: Product) {
  return product.category === 'sd'
    ? product.videoSpeedClass
    : getDisplayVpg(product);
}

function effectiveVpgClass(product: {
  vpgClass: VpgClass;
  vpgFacet?: VpgFacet;
}): VpgClass {
  if (product.vpgFacet === 'VPG1600') return 'VPG1600';
  if (product.vpgFacet === 'VPG800') return 'VPG800';
  if (product.vpgFacet === 'VPG400') return 'VPG400';
  if (product.vpgFacet === 'VPG200') return 'VPG200';
  return product.vpgClass;
}

function isComparableProduct(base: Product, candidate: Product) {
  if (base.id === candidate.id) return true;
  if (base.category !== candidate.category) return false;
  if (!isSimilarCapacity(base.capacityGb, candidate.capacityGb)) return false;

  if (base.category === 'sd') {
    return base.videoSpeedClass === candidate.videoSpeedClass;
  }

  return specLabel(base) === specLabel(candidate);
}

function isSimilarCapacity(baseGb: number, candidateGb: number) {
  if (!baseGb || !candidateGb) return false;
  const diffRatio = Math.abs(baseGb - candidateGb) / baseGb;
  return diffRatio <= 0.1;
}

function classNames(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        'rounded-3xl border border-slate-200 bg-white shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {right}
    </div>
  );
}

function BadgePill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'outline' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border border-rose-200 bg-rose-100 text-rose-700'
      : tone === 'outline'
      ? 'border border-slate-200 bg-white text-slate-700'
      : 'border border-slate-900 bg-slate-900 text-white';

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        toneClass
      )}
    >
      {children}
    </span>
  );
}

export default function MemoryPriceTrackerMVP() {
  const [activeTab, setActiveTab] = useState<MainTab>('tracked');

  const [html, setHtml] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');

  const [savedRows, setSavedRows] = useState<SavedSnapshotRow[]>([]);
  const [category, setCategory] = useState<Category>('sd');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [speedFilter, setSpeedFilter] = useState<string>('all');
  const [vpgFilter, setVpgFilter] = useState<string>('all');
  const [excludeKits, setExcludeKits] = useState(true);
  const [saleOnly, setSaleOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [selectedProductId, setSelectedProductId] =
    useState<string>('SN256V90');
    const [focusMode, setFocusMode] = useState(false);
  const [avgGranularity, setAvgGranularity] = useState<Granularity>('monthly');
  const [showRegularLine, setShowRegularLine] = useState(false);
  const [comparisonProductIds, setComparisonProductIds] = useState<string[]>([
    'SN256V90',
  ]);
  const [lastAutoSavedHtml, setLastAutoSavedHtml] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('bh_snapshots');
    if (!raw) return;
    try {
      setSavedRows(JSON.parse(raw));
    } catch {
      setSavedRows([]);
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'BH_IMPORT_PAYLOAD_FROM_EXTENSION') return;

      const payload = event.data.payload as ImportPayload | undefined;
      if (!payload?.html) return;

      setHtml(payload.html);
      setSourceUrl(payload.sourceUrl ?? '');
      setPageTitle(payload.pageTitle ?? '');

    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const parsedRows = useMemo<ImportedSnapshotRow[]>(() => {
    if (!html.trim()) return [];
    try {
      return parseBhSnapshot(html);
    } catch (error) {
      console.error('[MemoryPriceTrackerMVP] parse failed', error);
      return [];
    }
  }, [html]);

const importVpgFacet = inferVpgFacetFromUrl(sourceUrl);

  const filteredParsedRows = useMemo(() => {
    return parsedRows
      .filter((p) => p.category === category)
      .filter((p) => (excludeKits ? !p.isKit : true))
      .filter((p) => (saleOnly ? p.isOnSale : true))
      .filter((p) =>
        category === 'sd' && speedFilter !== 'all'
          ? p.videoSpeedClass === speedFilter
          : true
      )
        .filter((p) =>
          category !== 'sd' && vpgFilter !== 'all'
            ? getDisplayVpg(p) === vpgFilter
            : true
        )
      .filter((p) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [p.brand, p.name, p.model ?? '', p.bhNumber, String(p.capacityGb)]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [parsedRows, category, excludeKits, saleOnly, speedFilter, vpgFilter, query]);

  

  function refreshSavedRows() {
    const raw = localStorage.getItem('bh_snapshots');
    if (!raw) {
      setSavedRows([]);
      return;
    }

    try {
      setSavedRows(JSON.parse(raw));
    } catch {
      setSavedRows([]);
    }
  }

async function importExcelFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return;

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
  });

  const importedRows: SavedSnapshotRow[] = rows.map((row) => {
    const categoryLabel = String(row['カテゴリ'] ?? '').trim();

    const category: Category =
      categoryLabel === 'SD'
        ? 'sd'
        : categoryLabel === 'CFexpress Type A'
        ? 'cfexpress_a'
        : 'cfexpress_b';

    const vpgRaw = String(row['VPG'] ?? '').trim();
    const vpgClass: VpgClass =
      vpgRaw === 'VPG1600'
        ? 'VPG1600'
        : vpgRaw === 'VPG800'
        ? 'VPG800'
        : vpgRaw === 'VPG400'
        ? 'VPG400'
        : vpgRaw === 'VPG200'
        ? 'VPG200'
        : vpgRaw === 'non_vpg' || vpgRaw === 'Non-VPG'
        ? 'non_vpg'
        : 'unknown';

    const vpgFacet: VpgFacet =
      vpgRaw === 'VPG1600'
        ? 'VPG1600'
        : vpgRaw === 'VPG800'
        ? 'VPG800'
        : vpgRaw === 'VPG400'
        ? 'VPG400'
        : vpgRaw === 'VPG200'
        ? 'VPG200'
        : 'unknown';

    const speedRaw = String(row['スピードクラス'] ?? '').trim();
    const videoSpeedClass: VideoSpeedClass =
      speedRaw === 'V90'
        ? 'V90'
        : speedRaw === 'V60'
        ? 'V60'
        : speedRaw === 'V30'
        ? 'V30'
        : 'unknown';

    const saleFlag = String(row['セール中'] ?? '').trim().toLowerCase();
    const isOnSale = saleFlag === 'yes' || saleFlag === 'true' || saleFlag === '1';

    const stockRaw = String(row['在庫'] ?? '').trim();
    const stockStatus: SavedSnapshotRow['stockStatus'] =
      stockRaw === 'in_stock'
        ? 'in_stock'
        : stockRaw === 'backordered'
        ? 'backordered'
        : stockRaw === 'out_of_stock'
        ? 'out_of_stock'
        : 'unknown';

    return {
      bhNumber: String(row['BH番号'] ?? '').trim(),
      category,
      brand: String(row['ブランド'] ?? '').trim(),
      name: String(row['商品名'] ?? '').trim(),
      capacityGb:
        row['容量GB'] === '' || row['容量GB'] == null
          ? null
          : Number(row['容量GB']),
      model: String(row['型番'] ?? '').trim() || null,
      url: String(row['URL'] ?? '').trim() || null,
      videoSpeedClass,
      vpgClass,
      vpgFacet,
      isKit: false,
      kitSize: 1,
      regularPrice:
        row['通常価格'] === '' || row['通常価格'] == null
          ? null
          : Number(row['通常価格']),
      salePrice:
        row['セール価格'] === '' || row['セール価格'] == null
          ? null
          : Number(row['セール価格']),
      isOnSale,
      stockStatus,
      capturedAt: String(row['取得日'] ?? '').trim()
        ? new Date(String(row['取得日']).trim()).toISOString()
        : new Date().toISOString(),
      sourceUrl: String(row['取得元URL'] ?? row['URL'] ?? '').trim() || undefined,
      pageTitle: 'Excel Import',
    };
  });

  const raw = localStorage.getItem('bh_snapshots');
  const existing: SavedSnapshotRow[] = raw ? JSON.parse(raw) : [];

  const incoming = importedRows.filter((p) => {
    return !existing.some((e) => {
      return (
        e.bhNumber === p.bhNumber &&
        String(e.capturedAt).slice(0, 10) === String(p.capturedAt).slice(0, 10)
      );
    });
  });

  const merged = [...existing, ...incoming];

  localStorage.setItem('bh_snapshots', JSON.stringify(merged));
  refreshSavedRows();
  setActiveTab('tracked');
}


function handleImportSave() {
  const now = new Date().toISOString();
  const importVpgFacet = inferVpgFacetFromUrl(sourceUrl);

  const payload: SavedSnapshotRow[] = parsedRows.map((row) => ({
    ...row,
    vpgFacet: importVpgFacet,
    capturedAt: now,
    sourceUrl,
    pageTitle,
  }));

  const raw = localStorage.getItem('bh_snapshots');
  const existing: SavedSnapshotRow[] = raw ? JSON.parse(raw) : [];

  const incoming = payload.filter((p) => {
    return !existing.some((e) => {
      return (
        e.bhNumber === p.bhNumber &&
        String(e.capturedAt).slice(0, 10) === String(p.capturedAt).slice(0, 10)
      );
    });
  });

  const merged = [...existing, ...incoming];

  localStorage.setItem('bh_snapshots', JSON.stringify(merged));
  refreshSavedRows();

  setHtml('');
  setSourceUrl('');
  setPageTitle('');
  setActiveTab('tracked');
}

  useEffect(() => {
  if (!html.trim()) return;
  if (parsedRows.length === 0) return;
  if (lastAutoSavedHtml === html) return;

  handleImportSave();
  setLastAutoSavedHtml(html);
}, [html, parsedRows, lastAutoSavedHtml]);

  const runtimeProducts = useMemo<Product[]>(() => {
    if (savedRows.length === 0) return fallbackProducts;

    const map = new Map<string, Product>();

    for (const row of savedRows) {
      const id = row.bhNumber || `${row.brand}-${row.name}`;
      const normalizedCapacity = row.capacityGb ?? 0;
      const normalizedModel = row.model ?? '';
      const normalizedUrl = row.url ?? '';

      if (!map.has(id)) {
map.set(id, {
  id,
  bhNumber: row.bhNumber,
  category: row.category,
  brand: row.brand,
  name: row.name,
  capacityGb: normalizedCapacity,
  model: normalizedModel,
  url: normalizedUrl,
  videoSpeedClass: row.videoSpeedClass,
  vpgClass: row.vpgClass,
  vpgFacet: row.vpgFacet ?? 'unknown',
  isKit: row.isKit,
  kitSize: row.kitSize,
  firstSeenAt: row.capturedAt,
  lastSeenAt: row.capturedAt,
  isNewCandidate: false,
});
      } else {
        const existing = map.get(id)!;
        if (
          new Date(row.capturedAt).getTime() <
          new Date(existing.firstSeenAt).getTime()
        ) {
          existing.firstSeenAt = row.capturedAt;
        }
        if (
          new Date(row.capturedAt).getTime() >
          new Date(existing.lastSeenAt).getTime()
        ) {
          existing.lastSeenAt = row.capturedAt;
        }
      }
    }

    return Array.from(map.values()).filter((p) =>
      allowedBrands.includes(p.brand as (typeof allowedBrands)[number])
    );
  }, [savedRows]);

  const runtimeSnapshots = useMemo<PriceSnapshot[]>(() => {
    if (savedRows.length === 0) return fallbackSnapshots;

    return savedRows
      .filter((row) =>
        allowedBrands.includes(row.brand as (typeof allowedBrands)[number])
      )
      .map((row, index) => ({
        id: `${row.bhNumber || row.name}-${row.capturedAt}-${index}`,
        productId: row.bhNumber || `${row.brand}-${row.name}`,
        capturedAt: row.capturedAt,
        regularPrice: row.regularPrice,
        salePrice: row.salePrice,
        currency: 'USD' as const,
        isOnSale: row.isOnSale,
        stockStatus:
          row.stockStatus === 'unknown' ? 'in_stock' : row.stockStatus,
      }));
  }, [savedRows]);

  const runtimeDiscoveryEvents = useMemo<DiscoveryEvent[]>(() => {
    if (savedRows.length === 0) return fallbackDiscoveryEvents;

    const grouped = new Map<string, SavedSnapshotRow[]>();
    for (const row of savedRows) {
      const productId = row.bhNumber || `${row.brand}-${row.name}`;
      const list = grouped.get(productId) ?? [];
      list.push(row);
      grouped.set(productId, list);
    }

    return Array.from(grouped.entries()).map(([productId, rows], index) => {
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      );
      return {
        id: `evt-${index}`,
        productId,
        detectedAt: sorted[0].capturedAt,
        eventType: 'new_product_detected',
      };
    });
  }, [savedRows]);

  const sortSnapshotsForProduct = React.useCallback(
    (productId: string) => {
      return runtimeSnapshots
        .filter((s) => s.productId === productId)
        .sort(
          (a, b) =>
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
    },
    [runtimeSnapshots]
  );

  const getLatestPair = React.useCallback(
    (productId: string) => {
      const snapshots = sortSnapshotsForProduct(productId);
      const latestSnapshot = snapshots.at(-1) ?? null;
      const previousSnapshot =
        snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
      return { latestSnapshot, previousSnapshot };
    },
    [sortSnapshotsForProduct]
  );

  const getLowestSeenPrice = React.useCallback(
    (productId: string) => {
      const prices = sortSnapshotsForProduct(productId)
        .map(effectivePrice)
        .filter((p): p is number => p != null);
      return prices.length ? Math.min(...prices) : null;
    },
    [sortSnapshotsForProduct]
  );

 const isProductNew = React.useCallback(
  (productId: string) => {
    const evt = runtimeDiscoveryEvents.find(
      (e) =>
        e.productId === productId && e.eventType === 'new_product_detected'
    );
    if (!evt) return false;
    const now = Date.now();
    const ageDays =
      (now - new Date(evt.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 14;
  },
  [runtimeDiscoveryEvents]
);
  const getWeekDelta = React.useCallback(
    (productId: string) => {
      const { latestSnapshot, previousSnapshot } = getLatestPair(productId);
      const latest = effectivePrice(latestSnapshot);
      const previous = effectivePrice(previousSnapshot);
      if (latest == null || previous == null) return null;
      return latest - previous;
    },
    [getLatestPair]
  );

  const aggregateAveragePrice = React.useCallback(
    (productId: string, granularity: Granularity) => {
      const snapshots = sortSnapshotsForProduct(productId);
      const map = new Map<
        string,
        {
          sumRegular: number;
          countRegular: number;
          sumEffective: number;
          countEffective: number;
        }
      >();

      for (const snapshot of snapshots) {
        const key = bucketKey(snapshot.capturedAt, granularity);
        const prev = map.get(key) ?? {
          sumRegular: 0,
          countRegular: 0,
          sumEffective: 0,
          countEffective: 0,
        };

        if (snapshot.regularPrice != null) {
          prev.sumRegular += snapshot.regularPrice;
          prev.countRegular += 1;
        }

        const eff = effectivePrice(snapshot);
        if (eff != null) {
          prev.sumEffective += eff;
          prev.countEffective += 1;
        }

        map.set(key, prev);
      }

      return [...map.entries()].map(([period, value]) => ({
        period,
        averageRegularPrice: value.countRegular
          ? Number((value.sumRegular / value.countRegular).toFixed(1))
          : null,
        averageEffectivePrice: value.countEffective
          ? Number((value.sumEffective / value.countEffective).toFixed(1))
          : null,
      }));
    },
    [sortSnapshotsForProduct]
  );

  const summaries = useMemo<ProductSummary[]>(() => {
    return runtimeProducts.map((product) => {
      const { latestSnapshot, previousSnapshot } = getLatestPair(product.id);
      return {
        ...product,
        latestSnapshot,
        previousSnapshot,
        effectiveLatestPrice: effectivePrice(latestSnapshot),
        weeklyDelta: getWeekDelta(product.id),
        lowestSeenPrice: getLowestSeenPrice(product.id),
        isNew: isProductNew(product.id),
      };
    });
  }, [
    runtimeProducts,
    getLatestPair,
    getWeekDelta,
    getLowestSeenPrice,
    isProductNew,
  ]);

  const brands = useMemo(() => {
    return allowedBrands.filter((brand) =>
      runtimeProducts.some((p) => p.category === category && p.brand === brand)
    );
  }, [category, runtimeProducts]);

  const filteredProducts = useMemo(() => {
    return summaries
      .filter((p) => p.category === category)
      .filter((p) => (excludeKits ? !p.isKit : true))
      .filter((p) => (saleOnly ? p.latestSnapshot?.isOnSale : true))
      .filter((p) => (newOnly ? p.isNew : true))
      .filter((p) => (brandFilter === 'all' ? true : p.brand === brandFilter))
      .filter((p) =>
        category === 'sd' && speedFilter !== 'all'
          ? p.videoSpeedClass === speedFilter
          : true
      )
.filter((p) =>
  category !== 'sd' && vpgFilter !== 'all'
    ? effectiveVpgClass(p) === vpgFilter
    : true
)
      .filter((p) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [p.brand, p.name, p.model, p.bhNumber, String(p.capacityGb)]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aPrice = a.effectiveLatestPrice ?? Number.POSITIVE_INFINITY;
        const bPrice = b.effectiveLatestPrice ?? Number.POSITIVE_INFINITY;
        return aPrice - bPrice;
      });
  }, [
    summaries,
    category,
    excludeKits,
    saleOnly,
    newOnly,
    brandFilter,
    speedFilter,
    vpgFilter,
    query,
  ]);

  const selectedProduct =
    filteredProducts.find((p) => p.id === selectedProductId) ??
    filteredProducts[0] ??
    null;

  const visibleProducts = selectedProduct
  ? filteredProducts.filter((p) => p.id === selectedProduct.id)
  : filteredProducts;  

  const comparisonOptions = useMemo(() => {
    if (!selectedProduct) {
      return summaries
        .filter((p) => p.category === category)
        .filter((p) => (excludeKits ? !p.isKit : true))
        .filter((p) =>
          allowedBrands.includes(p.brand as (typeof allowedBrands)[number])
        )
        .sort(
          (a, b) =>
            a.brand.localeCompare(b.brand) || a.capacityGb - b.capacityGb
        );
    }

    return summaries
      .filter((p) => p.category === category)
      .filter((p) => (excludeKits ? !p.isKit : true))
      .filter((p) =>
        allowedBrands.includes(p.brand as (typeof allowedBrands)[number])
      )
      .filter((p) => isComparableProduct(selectedProduct, p))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [summaries, category, excludeKits, selectedProduct]);

  const activeComparisonProducts = useMemo(() => {
    if (!selectedProduct) return [] as Product[];
    const ids = Array.from(
      new Set([
        selectedProduct.id,
        ...comparisonProductIds.filter((id) => id !== selectedProduct.id),
      ])
    );
    return ids
      .map((id) => runtimeProducts.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  }, [selectedProduct, comparisonProductIds, runtimeProducts]);

const historyData = useMemo<HistoryRow[]>(() => {
  if (!selectedProduct) return [];

  const targetIds = Array.from(
    new Set([
      selectedProduct.id,
      ...comparisonProductIds.filter((id) => id !== selectedProduct.id),
    ])
  );
  const grouped = new Map<string, HistoryRow>();

  for (const productId of targetIds) {
    for (const snapshot of sortSnapshotsForProduct(productId)) {
      const day = dayLabel(snapshot.capturedAt);
      const existing = grouped.get(day) ?? {
        capturedAt: day,
      };
      existing[`${productId}_effective`] = effectivePrice(snapshot);
      existing[`${productId}_regular`] = snapshot.regularPrice;
      grouped.set(day, existing);
    }
  }

  return [...grouped.values()].sort((a, b) =>
    String(a.capturedAt).localeCompare(String(b.capturedAt))
  );
}, [selectedProduct, comparisonProductIds, sortSnapshotsForProduct]);

  const averageData = useMemo<HistoryRow[]>(() => {
    if (!selectedProduct) return [];

    const targetIds = Array.from(
      new Set([
        selectedProduct.id,
        ...comparisonProductIds.filter((id) => id !== selectedProduct.id),
      ])
    );
    const grouped = new Map<string, HistoryRow>();

    for (const productId of targetIds) {
      for (const row of aggregateAveragePrice(productId, avgGranularity)) {
        const existing = grouped.get(row.period) ?? { capturedAt: row.period };
        existing[`${productId}_avg_effective`] = row.averageEffectivePrice;
        existing[`${productId}_avg_regular`] = row.averageRegularPrice;
        grouped.set(row.period, existing);
      }
    }

    return [...grouped.values()].sort((a, b) =>
      String(a.capturedAt).localeCompare(String(b.capturedAt))
    );
  }, [
    selectedProduct,
    comparisonProductIds,
    avgGranularity,
    aggregateAveragePrice,
  ]);

  const stats = useMemo(() => {
    const active = filteredProducts;
    const onSaleCount = active.filter((p) => p.latestSnapshot?.isOnSale).length;
    const newCount = active.filter((p) => p.isNew).length;
    const newLowCount = active.filter((p) => {
      const latest = p.effectiveLatestPrice;
      return (
        latest != null &&
        p.lowestSeenPrice != null &&
        latest <= p.lowestSeenPrice
      );
    });
    return {
      total: active.length,
      onSaleCount,
      newCount,
      newLowCount: newLowCount.length,
    };
  }, [filteredProducts]);

  useEffect(() => {
    if (selectedProduct && selectedProduct.id !== selectedProductId) {
      setSelectedProductId(selectedProduct.id);
    }
    if (!selectedProduct && filteredProducts[0]) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [selectedProduct, selectedProductId, filteredProducts]);

  useEffect(() => {
    if (!selectedProduct) return;
    setComparisonProductIds((prev) => {
      const validIds = comparisonOptions.map((p) => p.id);
      const sanitized = prev.filter((id) => validIds.includes(id));
      return Array.from(
        new Set([
          selectedProduct.id,
          ...sanitized.filter((id) => id !== selectedProduct.id),
        ])
      ).slice(0, 4);
    });
  }, [selectedProduct, comparisonOptions]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Memory Media Tracker MVP
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              B&amp;H向けの自分用価格追跡アプリ。保存済みデータがあればそれを優先表示します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
  onClick={() => downloadExcel(savedRows)}
  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
>
  Excel出力
</button>
            <button className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              <Bell className="mr-2 h-4 w-4" />
              今週取得
            </button>
            <button className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              <Sparkles className="mr-2 h-4 w-4" />
              新製品差分検知
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          <button
            onClick={() => setActiveTab('tracked')}
            className={classNames(
              'rounded-2xl px-3 py-2 text-sm font-medium transition',
              activeTab === 'tracked'
                ? 'bg-slate-900 text-white'
                : 'bg-transparent text-slate-600 hover:bg-slate-100'
            )}
          >
            Tracked
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={classNames(
              'rounded-2xl px-3 py-2 text-sm font-medium transition',
              activeTab === 'import'
                ? 'bg-slate-900 text-white'
                : 'bg-transparent text-slate-600 hover:bg-slate-100'
            )}
          >
            Import
          </button>
        </div>

        {activeTab === 'tracked' ? (
          <>
            <div className="grid grid-cols-3 gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
              {(['sd', 'cfexpress_a', 'cfexpress_b'] as Category[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCategory(tab)}
                  className={classNames(
                    'rounded-2xl px-3 py-2 text-sm font-medium transition',
                    category === tab
                      ? 'bg-slate-900 text-white'
                      : 'bg-transparent text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {categoryLabel(tab)}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Tracked', value: stats.total },
                { label: 'On Sale', value: stats.onSaleCount },
                { label: 'New Products', value: stats.newCount },
                { label: 'New Lows', value: stats.newLowCount },
              ].map((item) => (
                <Panel key={item.label}>
                  <div className="p-5">
                    <div className="text-sm text-slate-500">{item.label}</div>
                    <div className="mt-2 text-3xl font-semibold text-slate-900">
                      {item.value}
                    </div>
                  </div>
                </Panel>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Panel>
                <PanelHeader title="Filters" />
                <div className="space-y-4 p-5">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="brand / model / capacity"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Brand
                    </label>
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="all">All</option>
                      {brands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </div>

                  {category === 'sd' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        SD Speed Class
                      </label>
                      <select
                        value={speedFilter}
                        onChange={(e) => setSpeedFilter(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="all">All</option>
                        <option value="V90">V90</option>
                        <option value="V60">V60</option>
                        <option value="V30">V30</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        VPG Class
                      </label>
                      <select
                        value={vpgFilter}
                        onChange={(e) => setVpgFilter(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="all">All</option>
<option value="VPG1600">VPG1600</option>
<option value="VPG800">VPG800</option>
<option value="VPG400">VPG400</option>
<option value="VPG200">VPG200</option>
<option value="non_vpg">Non-VPG</option>
<option value="unknown">Unknown</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={excludeKits}
                        onChange={(e) => setExcludeKits(e.target.checked)}
                      />
                      複数枚キットを除外
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={saleOnly}
                        onChange={(e) => setSaleOnly(e.target.checked)}
                      />
                      セール中のみ
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={newOnly}
                        onChange={(e) => setNewOnly(e.target.checked)}
                      />
                      新製品のみ
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="mb-2 font-medium text-slate-900">
                      データソース
                    </div>
                    <div>
                      {savedRows.length > 0
                        ? `保存済みデータ ${savedRows.length}件を使用中`
                        : 'ダミーデータ表示中'}
                    </div>
                  </div>
                </div>
              </Panel>

              <div className="space-y-6">
                <Panel>
                  <PanelHeader
  title={`${categoryLabel(category)} Products`}
  right={
    focusMode ? (
      <button
        onClick={() => setFocusMode(false)}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      >
        一覧に戻る
      </button>
    ) : null
  }
/>
                  <div className="grid gap-3 p-5">
                    {(focusMode && selectedProduct
  ? filteredProducts.filter((p) => p.id === selectedProduct.id)
  : filteredProducts
).map((product) => {
                      const isSelected = selectedProduct?.id === product.id;
                      const newLow =
                        product.effectiveLatestPrice != null &&
                        product.lowestSeenPrice != null &&
                        product.effectiveLatestPrice <= product.lowestSeenPrice;

                      return (
                        <button
                          key={product.id}
                          onClick={() => {
  setSelectedProductId(product.id);
  setFocusMode(true);
}}
                          className={classNames(
                            'rounded-2xl border p-4 text-left transition',
                            isSelected
                              ? 'border-slate-900 bg-slate-100'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <BadgePill tone="outline">
                                  {product.brand}
                                </BadgePill>
                                <BadgePill tone="outline">
                                  {product.capacityGb}GB
                                </BadgePill>
                                {product.category === 'sd' &&
                                  product.videoSpeedClass !== 'unknown' && (
                                    <BadgePill tone="outline">
                                      {product.videoSpeedClass}
                                    </BadgePill>
                                  )}
                                {product.category !== 'sd' && (
                                  <BadgePill tone="outline">
                                    {getDisplayVpg(product)}
                                  </BadgePill>
                                )}
                                {product.latestSnapshot?.isOnSale && (
                                  <BadgePill>SALE</BadgePill>
                                )}
                                {product.isNew && <BadgePill>NEW</BadgePill>}
                                {newLow && (
                                  <BadgePill tone="danger">NEW LOW</BadgePill>
                                )}
                              </div>
                              <div className="font-medium leading-snug text-slate-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-slate-500">
                                BH#{product.bhNumber}{' '}
                                {product.model ? `· ${product.model}` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-semibold text-slate-900">
                                {currency(product.effectiveLatestPrice)}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                Lowest: {currency(product.lowestSeenPrice)}
                              </div>
                              <div
                                className={classNames(
                                  'mt-1 text-sm',
                                  product.weeklyDelta != null &&
                                    product.weeklyDelta < 0
                                    ? 'text-emerald-600'
                                    : 'text-slate-500'
                                )}
                              >
                                先週比{' '}
                                {product.weeklyDelta == null
                                  ? '-'
                                  : currency(product.weeklyDelta)}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                        条件に合う商品がありません。
                      </div>
                    )}
                  </div>
                </Panel>

                {selectedProduct && (
                  <>
                    <Panel>
                      <PanelHeader
                        title={selectedProduct.name}
                        right={
                          <div className="flex flex-wrap gap-2">
                            {selectedProduct.category === 'sd' &&
                              selectedProduct.videoSpeedClass !== 'unknown' && (
                                <BadgePill tone="outline">
                                  {selectedProduct.videoSpeedClass}
                                </BadgePill>
                              )}
                            {selectedProduct.category !== 'sd' && (
                              <BadgePill tone="outline">
                                {getDisplayVpg(selectedProduct)}
                              </BadgePill>
                            )}
                            {selectedProduct.latestSnapshot?.isOnSale && (
                              <BadgePill>SALE</BadgePill>
                            )}
                            {selectedProduct.isNew && <BadgePill>NEW</BadgePill>}
                          </div>
                        }
                      />
                      <div className="grid gap-4 p-5 md:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="text-sm text-slate-500">Current</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900">
                            {currency(selectedProduct.effectiveLatestPrice)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="text-sm text-slate-500">Regular</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900">
                            {currency(
                              selectedProduct.latestSnapshot?.regularPrice ?? null
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="text-sm text-slate-500">Lowest Seen</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900">
                            {currency(selectedProduct.lowestSeenPrice)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="text-sm text-slate-500">Stock</div>
                          <div className="mt-2 text-2xl font-semibold capitalize text-slate-900">
                            {selectedProduct.latestSnapshot?.stockStatus.replace(
                              '_',
                              ' '
                            ) ?? '-'}
                          </div>
                        </div>
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader
                        title="Raw Price History"
                        right={
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={showRegularLine}
                              onChange={(e) => setShowRegularLine(e.target.checked)}
                            />
                            通常価格も表示
                          </label>
                        }
                      />
                      <div className="space-y-4 p-5">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-2 text-sm font-medium text-slate-800">
                            比較するカード
                          </div>
                          <div className="mb-3 text-xs text-slate-500">
                            同一カテゴリかつ、容量とSpecが近いものだけ表示しています。
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {comparisonOptions.map((product) => {
                              const checked = activeComparisonProducts.some(
                                (p) => p.id === product.id
                              );
                              const disabled =
                                !checked && activeComparisonProducts.length >= 4;

                              return (
                                <label
                                  key={product.id}
                                  className={classNames(
                                    'flex items-start gap-2 rounded-2xl border p-3 text-sm',
                                    checked
                                      ? 'border-slate-900 bg-white'
                                      : 'border-slate-200 bg-white',
                                    disabled && 'opacity-50'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={(e) => {
                                      const nextChecked = e.target.checked;
                                      setComparisonProductIds((prev) => {
                                        if (nextChecked) {
                                          return Array.from(
                                            new Set([
                                              selectedProduct.id,
                                              ...prev,
                                              product.id,
                                            ])
                                          ).slice(0, 4);
                                        }
                                        if (product.id === selectedProduct.id)
                                          return prev;
                                        return prev.filter(
                                          (id) => id !== product.id
                                        );
                                      });
                                    }}
                                  />
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      {product.brand} {product.capacityGb}GB /{' '}
                                      {specLabel(product)}
                                    </div>
                                    <div className="text-slate-500">
                                      {product.name}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {activeComparisonProducts.map((product) => (
                            <span
                              key={product.id}
                              className={classNames(
                                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                                product.id === selectedProduct.id
                                  ? 'text-white'
                                  : 'bg-white text-slate-700'
                              )}
                              style={{
                                backgroundColor:
                                  product.id === selectedProduct.id
                                    ? brandColor(product.brand)
                                    : 'white',
                                borderColor: brandColor(product.brand),
                                color:
                                  product.id === selectedProduct.id
                                    ? 'white'
                                    : brandColor(product.brand),
                              }}
                            >
                              {product.brand} {product.capacityGb}GB /{' '}
                              {specLabel(product)}
                              {product.id === selectedProduct.id ? ' (選択中)' : ''}
                            </span>
                          ))}
                        </div>

                        <div className="h-80 w-full min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="capturedAt" />
                              <YAxis domain={['auto', 'auto']} />
                              <Tooltip
                                formatter={(value) =>
                                  currency(typeof value === 'number' ? value : null)
                                }
                              />
                              <Legend />
                              {activeComparisonProducts.map((product) => (
                                <React.Fragment key={product.id}>
                                  <Line
                                    type="monotone"
                                    dataKey={`${product.id}_effective`}
                                    name={`${product.brand} ${
                                      product.capacityGb
                                    }GB ${specLabel(product)} Effective`}
                                    stroke={brandColor(product.brand)}
                                    strokeWidth={
                                      product.id === selectedProduct.id ? 3 : 2
                                    }
                                    dot
                                  />
                                  {showRegularLine && (
                                    <Line
                                      type="monotone"
                                      dataKey={`${product.id}_regular`}
                                      name={`${product.brand} ${
                                        product.capacityGb
                                      }GB ${specLabel(product)} Regular`}
                                      stroke={toRgba(
                                        brandColor(product.brand),
                                        0.35
                                      )}
                                      strokeWidth={2}
                                      strokeDasharray="4 4"
                                      dot={false}
                                    />
                                  )}
                                </React.Fragment>
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader
                        title="Average Price Graph"
                        right={
                          <select
                            value={avgGranularity}
                            onChange={(e) =>
                              setAvgGranularity(e.target.value as Granularity)
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="weekly">Weekly average</option>
                            <option value="monthly">Monthly average</option>
                            <option value="quarterly">Quarterly average</option>
                          </select>
                        }
                      />
                      <div className="p-5">
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          このグラフは、その
                          {avgGranularity === 'weekly'
                            ? '週'
                            : avgGranularity === 'monthly'
                            ? '月'
                            : '四半期'}
                          に取得した価格の平均を表示します。Raw Price History
                          と同じ比較カードに連動します。
                        </div>
                        <div className="h-80 w-full min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={averageData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="capturedAt" />
                              <YAxis domain={['auto', 'auto']} />
                              <Tooltip
                                formatter={(value) =>
                                  currency(typeof value === 'number' ? value : null)
                                }
                              />
                              <Legend />
                              {activeComparisonProducts.map((product) => (
                                <React.Fragment key={product.id}>
                                  <Line
                                    type="monotone"
                                    dataKey={`${product.id}_avg_effective`}
                                    name={`${product.brand} ${
                                      product.capacityGb
                                    }GB ${specLabel(product)} Avg Effective`}
                                    stroke={brandColor(product.brand)}
                                    strokeWidth={
                                      product.id === selectedProduct.id ? 3 : 2
                                    }
                                    dot
                                  />
                                  {showRegularLine && (
                                    <Line
                                      type="monotone"
                                      dataKey={`${product.id}_avg_regular`}
                                      name={`${product.brand} ${
                                        product.capacityGb
                                      }GB ${specLabel(product)} Avg Regular`}
                                      stroke={toRgba(
                                        brandColor(product.brand),
                                        0.35
                                      )}
                                      strokeWidth={2}
                                      strokeDasharray="4 4"
                                      dot={false}
                                    />
                                  )}
                                </React.Fragment>
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader title="Product Signals" />
                      <div className="grid gap-4 p-5 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                            <Package2 className="h-4 w-4" />
                            New Product
                          </div>
                          <div className="text-sm text-slate-600">
                            初検知日: {selectedProduct.firstSeenAt}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                            <Tag className="h-4 w-4" />
                            Sale State
                          </div>
                          <div className="text-sm text-slate-600">
                            現在{' '}
                            {selectedProduct.latestSnapshot?.isOnSale
                              ? 'セール中'
                              : '通常価格'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                            <TrendingDown className="h-4 w-4" />
                            Floor Check
                          </div>
                          <div className="text-sm text-slate-600">
                            底値比:{' '}
                            {selectedProduct.effectiveLatestPrice != null &&
                            selectedProduct.lowestSeenPrice != null
                              ? currency(
                                  selectedProduct.effectiveLatestPrice -
                                    selectedProduct.lowestSeenPrice
                                )
                              : '-'}
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </>
                )}
              </div>
            </div>
          </>
 ) : (
  <div className="space-y-6">
    <Panel>
      <PanelHeader title="Import from extension" />
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-600">
          B&H商品ページで拡張を実行すると、このタブにHTMLと解析結果が入ります。
          parse成功時は自動で保存され、Trackedへ戻ります。
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-sm font-medium text-slate-900">
            B&H quick link
          </div>
          <div className="break-all text-xs text-slate-600">
            https://www.bhphotovideo.com/c/browse/Flash-Drives-Storage-Devices/ci/6231/N/4093113322
          </div>
          <div className="mt-3">
            <a
              href="https://www.bhphotovideo.com/c/browse/Flash-Drives-Storage-Devices/ci/6231/N/4093113322"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              B&Hを開く
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="mb-2 font-medium text-slate-900">Import Source</div>
          <div>{sourceUrl || 'まだ取り込みがありません'}</div>
          {pageTitle ? <div className="mt-1 text-xs">{pageTitle}</div> : null}
        </div>

        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="min-h-[240px] w-full rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs"
          placeholder="B&HページのHTMLをここに貼る"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setHtml('');
              setSourceUrl('');
              setPageTitle('');
              setLastAutoSavedHtml('');
            }}
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            クリア
          </button>
<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
  <div className="mb-2 text-sm font-medium text-slate-900">
    Excel import
  </div>
  <input
    type="file"
    accept=".xlsx,.xls"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await importExcelFile(file);
      e.target.value = '';
    }}
    className="block w-full text-sm text-slate-700"
  />
  <div className="mt-2 text-xs text-slate-500">
    以前に出力したExcelを読み込み、保存済みデータに追加します。
  </div>
</div>

        </div>
      </div>
    </Panel>

    <Panel>
      <PanelHeader title={`Parsed products (${parsedRows.length})`} />
      <div className="grid gap-3 p-5">
        {parsedRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            解析済みデータがありません。HTML取得後、parseに成功すれば自動保存されます。
          </div>
        ) : (
          parsedRows.map((row) => (
            <div
              key={`${row.bhNumber}-${row.name}`}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <BadgePill tone="outline">{row.brand}</BadgePill>
                    <BadgePill tone="outline">
                      {row.capacityGb ?? '-'}GB
                    </BadgePill>
{row.category === 'sd' ? (
  <BadgePill tone="outline">{row.videoSpeedClass}</BadgePill>
) : (
  <BadgePill tone="outline">
    {importVpgFacet === 'VPG400'
      ? 'VPG400'
      : importVpgFacet === 'VPG200'
      ? 'VPG200'
      : 'non_vpg'}
  </BadgePill>
)}
                    {row.isOnSale ? <BadgePill>SALE</BadgePill> : null}
                  </div>
                  <div className="font-medium text-slate-900">{row.name}</div>
                  <div className="text-sm text-slate-500">
                    BH#{row.bhNumber} {row.model ? `· ${row.model}` : ''}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-semibold text-slate-900">
                    {currency(row.salePrice)}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Regular: {currency(row.regularPrice)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  </div>
)}
      </div>
    </div>
  );
}