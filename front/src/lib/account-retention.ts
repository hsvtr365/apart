import { createHmac, randomBytes } from "node:crypto";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export function oneYearAfter(now = new Date()) {
  const next = new Date(now);
  const month = next.getUTCMonth();
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  if (next.getUTCMonth() !== month) next.setUTCDate(0);
  return next;
}
export function abuseKey(kakaoId: string) {
  const secret = process.env.ABUSE_HMAC_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("ABUSE_HMAC_SECRET must be configured");
  return createHmac("sha256", secret)
    .update("kakao:v1:" + kakaoId)
    .digest("hex");
}
export async function purgeExpiredAccountData(now = new Date()) {
  return db().$transaction(async (tx) => {
    const nicknameLogs = await tx.nicknameChangeLog.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    const events = await tx.accountSecurityEvent.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    const expiredUsers = await tx.user.findMany({
      where: { withdrawnAt: { not: null }, abuseLinkExpiresAt: { lte: now } },
      select: { id: true },
    });
    const ids = expiredUsers.map((user) => user.id);
    await tx.like.updateMany({
      where: { userId: { in: ids } },
      data: { abuseIdentityId: null },
    });
    await tx.user.updateMany({
      where: { id: { in: ids } },
      data: { abuseIdentityId: null, abuseLinkExpiresAt: null },
    });
    const identities = await tx.abuseIdentity.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return {
      nicknameLogs: nicknameLogs.count,
      events: events.count,
      detachedAccounts: ids.length,
      identities: identities.count,
    };
  });
}
export async function linkIdentity(
  tx: Prisma.TransactionClient,
  userId: string,
  kakaoId: string,
) {
  const id = abuseKey(kakaoId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"abuse:" + id}))`;
  await tx.abuseIdentity.upsert({
    where: { id },
    create: { id },
    update: { expiresAt: null },
  });
  await tx.user.update({
    where: { id: userId },
    data: { abuseIdentityId: id, abuseLinkExpiresAt: null },
  });
  // Old likes predate identity tracking. Backfill on the account's next authenticated action.
  const likes = await tx.like.findMany({
    where: { userId, abuseIdentityId: null },
  });
  for (const like of likes) {
    const previous = await tx.like.findUnique({
      where: {
        abuseIdentityId_postId: { abuseIdentityId: id, postId: like.postId },
      },
    });
    if (previous)
      await tx.like.delete({
        where: { userId_postId: { userId, postId: like.postId } },
      });
    else
      await tx.like.update({
        where: { userId_postId: { userId, postId: like.postId } },
        data: { abuseIdentityId: id },
      });
  }
  return id;
}
export async function loginAccount(kakaoId: string) {
  await purgeExpiredAccountData();
  return db().$transaction(async (tx) => {
    const identity = abuseKey(kakaoId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"abuse:" + identity}))`;
    let user = await tx.user.findUnique({ where: { kakaoId } });
    if (!user) {
      user = await tx.user.create({
        data: { kakaoId, nickname: "이웃" + randomBytes(3).toString("hex") },
      });
      await tx.nicknameChangeLog.create({
        data: {
          userId: user.id,
          after: user.nickname,
          reason: "SIGNUP",
          expiresAt: oneYearAfter(),
        },
      });
      await linkIdentity(tx, user.id, kakaoId);
      await tx.accountSecurityEvent.create({
        data: {
          identityId: identity,
          userId: user.id,
          reason: "REGISTER",
          expiresAt: oneYearAfter(),
        },
      });
    } else {
      if (user.withdrawnAt) throw new Error("Withdrawn account cannot log in");
      await linkIdentity(tx, user.id, kakaoId);
    }
    return tx.user.findUniqueOrThrow({ where: { id: user.id } });
  });
}
export async function withdrawAccount(userId: string) {
  await purgeExpiredAccountData();
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"account:" + userId}))`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.withdrawnAt) throw new Error("Already withdrawn");
    const now = new Date(),
      expiry = oneYearAfter(now);
    const identity = user.kakaoId
      ? await linkIdentity(tx, userId, user.kakaoId)
      : user.abuseIdentityId;
    await tx.nicknameChangeLog.updateMany({
      where: { userId },
      data: { before: null, after: null },
    });
    await tx.nicknameChangeLog.create({
      data: {
        userId,
        after: "탈퇴한 이용자",
        reason: "WITHDRAWAL",
        expiresAt: expiry,
      },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        kakaoId: null,
        nickname: "탈퇴한 이용자",
        building: null,
        withdrawnAt: now,
        role: "USER",
        permission: 1,
        abuseLinkExpiresAt: identity ? expiry : null,
      },
    });
    if (identity) {
      await tx.accountSecurityEvent.create({
        data: {
          identityId: identity,
          userId,
          reason: "WITHDRAW",
          expiresAt: expiry,
        },
      });
      const active = await tx.user.count({
        where: { abuseIdentityId: identity, withdrawnAt: null },
      });
      if (!active)
        await tx.abuseIdentity.update({
          where: { id: identity },
          data: { expiresAt: expiry },
        });
    }
  });
}
export async function changeProfile(
  userId: string,
  input: { nickname: string; building?: string | null },
) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"account:" + userId}))`;
    const before = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (before.withdrawnAt)
      throw new Error("Withdrawn account cannot change profile");
    const user = await tx.user.update({ where: { id: userId }, data: input });
    if (before.nickname !== user.nickname)
      await tx.nicknameChangeLog.create({
        data: {
          userId,
          before: before.nickname,
          after: user.nickname,
          reason: "USER_EDIT",
          expiresAt: oneYearAfter(),
        },
      });
    return {
      id: user.id,
      nickname: user.nickname,
      building: user.building,
      permission: user.permission,
    };
  });
}
export async function setAccountLike(
  userId: string,
  postId: string,
  liked: boolean,
) {
  await purgeExpiredAccountData();
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"account:" + userId}))`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.withdrawnAt)
      throw new Error("Withdrawn account cannot like posts");
    const identity = user.kakaoId
      ? await linkIdentity(tx, userId, user.kakaoId)
      : user.abuseIdentityId;
    if (liked && identity) {
      const previous = await tx.like.findUnique({
        where: {
          abuseIdentityId_postId: { abuseIdentityId: identity, postId },
        },
      });
      if (previous && previous.userId !== userId) {
        await tx.accountSecurityEvent.create({
          data: {
            identityId: identity,
            userId,
            postId,
            reason: "DUPLICATE_LIKE",
            expiresAt: oneYearAfter(),
          },
        });
        return false;
      }
    }
    if (liked)
      await tx.like.upsert({
        where: { userId_postId: { userId, postId } },
        create: { userId, postId, abuseIdentityId: identity },
        update: {},
      });
    else await tx.like.deleteMany({ where: { userId, postId } });
    return true;
  });
}
