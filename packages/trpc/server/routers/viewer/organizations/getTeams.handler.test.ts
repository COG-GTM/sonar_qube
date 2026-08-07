import prismock from "../../../../../../tests/libs/__mocks__/prisma";

import { describe, it, expect } from "vitest";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../types";
import getTeamsHandler from "./getTeams.handler";

describe("getTeamsHandler", () => {
  it("returns the teams that belong to the caller's organization", async () => {
    const orgId = 100;
    await prismock.team.create({ data: { id: orgId, name: "Org" } });
    await prismock.team.create({ data: { id: 101, name: "Team A", parentId: orgId } });
    await prismock.team.create({ data: { id: 102, name: "Team B", parentId: orgId } });
    // team in another org -> excluded
    await prismock.team.create({ data: { id: 103, name: "Other", parentId: 200 } });

    const ctx = {
      user: { id: 1, organizationId: orgId, profiles: [] } as unknown as NonNullable<TrpcSessionUser>,
    };

    const result = await getTeamsHandler({ ctx });
    expect(result).toEqual(
      expect.arrayContaining([
        { id: 101, name: "Team A" },
        { id: 102, name: "Team B" },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it("throws UNAUTHORIZED when the caller has no organization", async () => {
    const ctx = {
      user: {
        id: 1,
        organizationId: null,
        profiles: [{ organizationId: null }],
      } as unknown as NonNullable<TrpcSessionUser>,
    };

    await expect(getTeamsHandler({ ctx })).rejects.toSatisfy(
      (err) => err instanceof TRPCError && err.code === "UNAUTHORIZED"
    );
  });
});
