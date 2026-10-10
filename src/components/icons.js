import {
  LayoutGrid,
  BookOpen,
  Receipt,
  TrendingUp,
  Cloud,
  Tag,
  Dumbbell,
  List,
  CircleDot,
  Bookmark,
  Sparkles,
} from "lucide-react";

export const CATEGORY_ICONS = {
  all: LayoutGrid,
  book: BookOpen,
  tax: Receipt,
  trend: TrendingUp,
  aws: Cloud,
  deal: Tag,
  gym: Dumbbell,
  ai: Sparkles,
};

export const CATEGORY_LABELS = {
  all: "All",
  book: "Book",
  tax: "Tax",
  trend: "Trend",
  aws: "AWS",
  deal: "Deal",
  gym: "Gym",
  ai: "AI",
};

export const VIEW_ICONS = {
  all: List,
  unread: CircleDot,
  saved: Bookmark,
};

export const VIEW_LABELS = {
  all: "All",
  unread: "Unread",
  saved: "Saved",
};

export const ICON_STROKE = 1.75;
