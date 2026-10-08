export const categories = {
  FOOD: "먹거리",
  NOTICE: "관리사무소",
  MARKET: "장터",
} as const;
export type Category = keyof typeof categories;
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
  place: string;
  mapX: number | null;
  mapY: number | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl: string | null;
  createdAt: string;
  endDate: string | null;
  endTime: string | null;
  authorId: string;
  author: string;
  likes: number;
  liked: boolean;
  commentCount: number;
  comments: Comment[];
  presence: "ARRIVED" | "GONE" | null;
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
  place: string;
  mapX: number | null;
  mapY: number | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl: string | null;
  endDate: string | null;
  endTime: string | null;
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
