import type { Prisma } from "@/generated/prisma/client";

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function lockActiveAccount(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"account:" + userId}))`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.withdrawnAt)
    throw new HttpError("로그인 후 이용해주세요.", 401);
  return user;
}
export async function lockPost(tx: Prisma.TransactionClient, postId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"post:" + postId}))`;
}
