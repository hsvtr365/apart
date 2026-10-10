import type { Bootstrap, Post } from "./types";
const now = new Date().toISOString();
const make = (
  id: string,
  title: string,
  body: string,
  category: Post["category"],
  place: string,
  mapX: number,
  mapY: number,
  authorId = "neighbor",
): Post => ({
  id,
  title,
  body,
  category,
  mapX,
  mapY,
  authorId,
  author: authorId === "demo" ? "행복한 이웃" : "동네 이웃",
  authorBuilding: authorId === "demo" ? "2001동" : null,
  imageUrl: "/" + category.toLowerCase() + ".svg",
  scheduleType: "WEEKLY", startDate: null, finishDate: null,
  weekdays: [], seasons: [], arrivalTime: null, departureTime: null,
  createdAt: now,
  likes: 0,
  liked: false,
  commentCount: 0,
  comments: [],
  presence: null,
  observedAt: null,
});
export function demoData(): Bootstrap {
  const posts = [
    make(
      "1",
      "정문 앞 붕어빵 트럭",
      "정문 앞에 붕어빵 트럭이 왔어요. 팥도 슈크림도 있어요. 아직 줄은 짧아요! 정문 오른쪽 상가 앞에서 판매 중입니다. 종료 시간은 아직 정해지지 않았대요.",
      "FOOD",
      "정문",
      25,
      60,
    ),
    make(
      "2",
      "103동 수도관 공사",
      "수도관 공사로 일부 보행로가 통제됩니다. 관리사무소 안내를 확인하고 안전하게 통행해주세요.",
      "NOTICE",
      "103동",
      75,
      65,
    ),
    make(
      "3",
      "중앙광장 작은 장터",
      "중앙광장에서 작은 장터가 열립니다. 이웃들과 가볍게 둘러보세요.",
      "MARKET",
      "중앙광장",
      55,
      25,
    ),
    make(
      "4",
      "아이 책 나눔해요",
      "깨끗하게 읽은 그림책 다섯 권 나눔합니다. 관심 있으시면 댓글 남겨주세요.",
      "MARKET",
      "후문",
      10,
      25,
      "demo",
    ),
  ];
  posts[0].comments = [
    {
      id: "c1",
      body: "슈크림도 있나요?",
      author: "책읽는 이웃",
      authorId: "neighbor",
      createdAt: now,
    },
    {
      id: "c2",
      body: "네, 팥이랑 슈크림 둘 다 있어요.",
      author: "행복한 이웃",
      authorId: "demo",
      createdAt: now,
    },
  ];
  posts[3].comments = [
    {
      id: "c3",
      body: "아직 나눔 가능한가요?",
      author: "책읽는 이웃",
      authorId: "neighbor",
      createdAt: now,
    },
  ];
  posts.forEach((p) => (p.commentCount = p.comments.length));
  return {
    mode: "demo",
    user: { id: "demo", nickname: "행복한 이웃", building: "2001동" },
    posts,
    kakaoReady: false,
    nextCursor: null,
    notifications: [
      {
        id: "n1",
        postId: "4",
        commentId: "c3",
        title: posts[3].title,
        body: "아직 나눔 가능한가요?",
        author: "책읽는 이웃",
        readAt: null,
      },
    ],
  };
}
