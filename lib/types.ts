export const conditions = ["Poor", "Fair", "Good", "Great"] as const;

export const statuses = [
  "Inventory",
  "Ready to Convert",
  "In Progress",
  "Finished Journal",
  "Listed",
  "Sold"
] as const;

export const bookTypes = [
  "Regular Book",
  "Little Golden Book",
  "Children's Book",
  "Vintage Book",
  "Journal Project",
  "Other"
] as const;

export type BookCondition = (typeof conditions)[number];
export type BookStatus = (typeof statuses)[number];
export type BookType = (typeof bookTypes)[number];

export type Book = {
  id: string;
  user_id?: string | null;
  inventory_prefix: string;
  inventory_number: number;
  inventory_id: string;
  title: string;
  author: string;
  publisher: string;
  published_year: string;
  isbn: string;
  cover_url: string;
  photo_urls: string[];
  category: string;
  book_type: BookType;
  condition: BookCondition;
  cost: number;
  status: BookStatus;
  listed_price: number;
  sold_price: number;
  profit: number;
  notes: string;
  show_public: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BookPhoto = {
  id: string;
  book_id: string;
  user_id?: string | null;
  url: string;
  storage_path?: string | null;
  sort_order: number;
  created_at?: string;
};

export type BookDraft = Omit<
  Book,
  "id" | "inventory_id" | "inventory_prefix" | "inventory_number" | "profit"
>;

export type GoogleBookSuggestion = {
  title: string;
  author: string;
  publisher: string;
  published_year: string;
  isbn: string;
  thumbnail: string;
  category: string;
  description?: string;
};

export type DashboardStats = {
  total: number;
  inventory: number;
  ready: number;
  inProgress: number;
  finished: number;
  listed: number;
  sold: number;
  profit: number;
};
