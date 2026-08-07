import prismock from "../../../../../../tests/libs/__mocks__/prisma";

import { describe, it, expect } from "vitest";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../types";
import { findKeyOfTypeHandler } from "./findKeyOfType.handler";

async function seedApiKey(
  id: string,
  data: { userId: number; appId?: string | null; teamId?: number | null }
) {
  await prismock.apiKey.create({
    data: {
      id,
      hashedKey: `hashed-${id}`,
      userId: data.userId,
      appId: data.appId ?? null,
      teamId: data.teamId ?? null,
    },
  });
}

describe("findKeyOfTypeHandler", () => {
  it("returns the caller's personal API keys filtered by appId", async () => {
    const userId = 1;
    await seedApiKey("k1", { userId, appId: "zapier" });
    await seedApiKey("k2", { userId, appId: "make" });
    // another user's key -> excluded
    await seedApiKey("k3", { userId: 2, appId: "zapier" });

    const ctx = { user: { id: userId } as NonNullable<TrpcSessionUser> };
    const result = await findKeyOfTypeHandler({ ctx, input: { appId: "zapier" } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: "k1", userId, appId: "zapier" }));
  });

  it("returns an empty array when the caller has no matching keys", async () => {
    const ctx = { user: { id: 42 } as NonNullable<TrpcSessionUser> };
    await expect(findKeyOfTypeHandler({ ctx, input: { appId: "zapier" } })).resolves.toEqual([]);
  });

  it("throws UNAUTHORIZED when the caller is not an admin/owner of the team", async () => {
    const ctx = { user: { id: 1 } as NonNullable<TrpcSessionUser> };
    await expect(findKeyOfTypeHandler({ ctx, input: { teamId: 10 } })).rejects.toSatisfy(
      (err) => err instanceof TRPCError && err.code === "UNAUTHORIZED"
    );
  });
});
