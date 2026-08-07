import prismock from "../../../../../../tests/libs/__mocks__/prisma";

import { describe, it, expect } from "vitest";

import { MembershipRole } from "@calcom/prisma/enums";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

import hasTeamPlanHandler from "./hasTeamPlan.handler";

describe("hasTeamPlanHandler", () => {
  it("returns hasTeamPlan: true for an accepted membership of a team with a slug", async () => {
    const userId = 1;
    await prismock.team.create({ data: { id: 10, name: "Team 10", slug: "team-10" } });
    await prismock.membership.create({
      data: { userId, teamId: 10, accepted: true, role: MembershipRole.MEMBER },
    });

    const ctx = { user: { id: userId } as NonNullable<TrpcSessionUser> };
    await expect(hasTeamPlanHandler({ ctx })).resolves.toEqual({ hasTeamPlan: true });
  });

  it("returns hasTeamPlan: false when the only membership is not accepted", async () => {
    const userId = 2;
    await prismock.team.create({ data: { id: 20, name: "Team 20", slug: "team-20" } });
    await prismock.membership.create({
      data: { userId, teamId: 20, accepted: false, role: MembershipRole.MEMBER },
    });

    const ctx = { user: { id: userId } as NonNullable<TrpcSessionUser> };
    await expect(hasTeamPlanHandler({ ctx })).resolves.toEqual({ hasTeamPlan: false });
  });

  // the handler's team filter is `slug: { not: null }`, so a slug-less team must not count
  it("returns hasTeamPlan: false for an accepted membership of a team without a slug", async () => {
    const userId = 3;
    await prismock.team.create({ data: { id: 30, name: "Team 30", slug: null } });
    await prismock.membership.create({
      data: { userId, teamId: 30, accepted: true, role: MembershipRole.MEMBER },
    });

    const ctx = { user: { id: userId } as NonNullable<TrpcSessionUser> };
    await expect(hasTeamPlanHandler({ ctx })).resolves.toEqual({ hasTeamPlan: false });
  });

  it("returns hasTeamPlan: false when the user has no memberships", async () => {
    const ctx = { user: { id: 999 } as NonNullable<TrpcSessionUser> };
    await expect(hasTeamPlanHandler({ ctx })).resolves.toEqual({ hasTeamPlan: false });
  });
});
