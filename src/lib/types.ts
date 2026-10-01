export type Platform = "Posts" | "TikTok" | "Instagram";

export type ShipSpeed = "us" | "pod" | "import";

export type Lane = "kitchen" | "apparel" | "sport" | "utility" | "food" | "party-extra";

export type SupplierQuote = {
  id: string;
  name: string;
  origin: string;
  speed: ShipSpeed;
  unitCost: number;
  inboundShipping: number;
  packaging: number;
  shipDaysMin: number;
  shipDaysMax: number;
  rating: number;
  reviews: number;
  moq: number;
  returnWindowDays: number;
  note: string;
};

export type MockupIdea = {
  title: string;
  direction: string;
  layout: "line" | "stack" | "pair";
  src: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  titleLead: string;
  category: string;
  lane: Lane;
  occasion: string;
  material: string;
  size: string;
  colorway: string;
  swatch: string;
  ceiling: number;
  neededInDays?: number;
  box: string;
  useLine: string;
  colorNote: string;
  hook: string;
  searchPhrase: string;
  keywords: string[];
  complements: string;
  trend: {
    platform: Platform;
    title: string;
    signal: string;
    evidence: string;
  };
  mockups: MockupIdea[];
  suppliers: SupplierQuote[];
};

export type ShortlistStatus = "review" | "approved" | "passed";

export type PipelineItem = {
  productId: string;
  status: ShortlistStatus;
  discoveredOn: string;
  pickedSupplierId: string | null;
};

export type PriceId = "floor" | "target" | "stretch";

export type Listing = {
  productId: string;
  supplierId: string;
  titles: [string, string, string];
  titleIndex: number;
  description: string;
  bullets: string[];
  tags: string[];
  prices: {
    id: PriceId;
    label: string;
    retail: number;
    margin: number;
    capped: boolean;
    note: string;
  }[];
  priceId: PriceId;
  status: "draft" | "ready";
};

export type Reply = {
  subject: string;
  body: string;
  status: "draft" | "approved";
};

export type OrderStatus =
  | "processing"
  | "in_transit"
  | "delayed"
  | "delivered"
  | "quality";

export type Order = {
  id: string;
  number: string;
  customer: string;
  email: string;
  productId: string;
  productName: string;
  qty: number;
  merchandise: number;
  shippingPaid: number;
  placedOn: string;
  carrier: string;
  tracking: string;
  eta: string;
  needBy: string;
  status: OrderStatus;
  flag: "delay" | "quality" | null;
  issue: string | null;
  reply: Reply | null;
};

export type PostChannel = "X" | "TikTok" | "Instagram" | "Meta";

export type Post = {
  id: string;
  channel: PostChannel;
  label: string;
  headline: string;
  body: string;
  status: "draft" | "approved";
};

export type Campaign = {
  productId: string;
  posts: Post[];
};

export type BotId = "scout" | "listings" | "orders" | "marketing";

export type LogLine = {
  id: string;
  at: number;
  bot: BotId;
  text: string;
};

export type SelectionKey = "scout" | "listing" | "order" | "marketing";

export type DeskState = {
  version: 3;
  seededOn: string;
  bots: Record<BotId, { running: boolean }>;
  pipeline: PipelineItem[];
  queue: string[];
  listings: Listing[];
  orders: Order[];
  campaigns: Campaign[];
  log: LogLine[];
  recheck: number;
  selected: Record<SelectionKey, string | null>;
};
