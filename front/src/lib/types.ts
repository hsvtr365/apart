export const categories = {
  FOOD: "먹거리",
  NOTICE: "관리사무소",
  MARKET: "장터",
} as const;
export type Category = keyof typeof categories;
export const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];
export const seasonLabels: Record<string, string> = { SPRING: "봄", SUMMER: "여름", AUTUMN: "가을", WINTER: "겨울" };
export type User = { id: string; nickname: string; building: string | null };
export type Comment = {
  id: string;
  body: string;
  authorId: string;
  author: string;
  createdAt: string;
};
export type Post = {
  id: string;
  title: string;
  body: string;
  category: Category;
  mapX: number | null;
  mapY: number | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl: string | null;
  scheduleType: "WEEKLY" | "ONCE";
  startDate: string | null;
  finishDate: string | null;
  weekdays: number[];
  seasons: string[];
  arrivalTime: string | null;
  departureTime: string | null;
  createdAt: string;
  authorId: string;
  author: string;
  likes: number;
  authorBuilding?: string | null;
  liked: boolean;
  commentCount: number;
  comments: Comment[];
  presence: "ARRIVED" | "GONE" | null;
  presenceConfirmed?: boolean;
  observedAt: string | null;
};
export type Notice = {
  id: string;
  postId: string;
  commentId: string;
  title: string;
  body: string;
  author: string;
  readAt: string | null;
};
export type Bootstrap = {
  mode: "demo" | "live";
  user: User | null;
  posts: Post[];
  notifications: Notice[];
  kakaoReady: boolean;
  nextCursor: string | null;
};
export type PostInput = {
  title: string;
  body: string;
  category: Category;
  mapX: number | null;
  mapY: number | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl: string | null;
  scheduleType: "WEEKLY" | "ONCE";
  startDate: string | null;
  finishDate: string | null;
  weekdays: number[];
  seasons: string[];
  arrivalTime: string | null;
  departureTime: string | null;
};
export function clock(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
