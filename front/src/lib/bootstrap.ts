import { cache } from "react";
import { currentUser } from "./auth";
import { demoData } from "./demo";
import { getPosts, getTodayPosts, notifications } from "./queries";
import type { Bootstrap } from "./types";

// Request-scoped only: account data must never enter a shared page cache.
export const getBootstrap = cache(async (): Promise<Bootstrap> => {
  if (process.env.DEMO_MODE === "true") return demoData();
  const user = await currentUser();
  const [feed, todayPosts, userNotifications] = await Promise.all([
    getPosts(user?.id),
    getTodayPosts(user?.id),
    user ? notifications(user.id) : Promise.resolve([]),
  ]);
  return {
    mode: "live",
    user: user
      ? {
          id: user.id,
          nickname: user.nickname,
          building: user.building,
          permission: user.permission,
        }
      : null,
    ...feed,
    todayPosts,
    notifications: userNotifications,
    kakaoReady: !!process.env.KAKAO_CLIENT_ID,
  };
});
