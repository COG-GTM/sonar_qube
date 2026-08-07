import prismock from "../../../../tests/libs/__mocks__/prisma";

import type { Prisma } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ErrorCode } from "@calcom/lib/errorCodes";

import { PaymentService } from "./PaymentService";

const post = vi.fn();
const get = vi.fn();

vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));

const validKey = {
  isSandbox: true,
  sandbox: { apiKey: "sandbox-key", saltKey: "salt" },
};

const payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency"> = {
  amount: 2000,
  currency: "SGD",
};

async function seedApp() {
  await prismock.app.create({
    data: { slug: "hitpay", dirName: "hitpay", categories: ["payment"], enabled: true },
  });
}

// Each booking gets its own hour so that seeding several in one test stays inert with
// respect to `create`'s duplicate-timeslot guard. That guard only counts PENDING /
// AWAITING_HOST rows and the schema default is ACCEPTED, so identical windows would be
// harmless today -- distinct windows keep it that way if a test ever seeds a pending row.
async function seedBooking(bookingId: number, overrides: Record<string, unknown> = {}) {
  const hour = bookingId % 24;
  await prismock.booking.create({
    data: {
      id: bookingId,
      uid: `booking-${bookingId}`,
      title: "Paid meeting",
      startTime: new Date(Date.UTC(2030, 0, 1, hour, 0, 0)),
      endTime: new Date(Date.UTC(2030, 0, 1, hour + 1, 0, 0)),
      ...overrides,
    },
  });
}

function callCreate(service: PaymentService, bookingId: number) {
  return service.create(payment, bookingId, 1, "host", "Booker Name", "ON_BOOKING", "booker@example.com");
}

describe("HitPay PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: { id: "hitpay-req-1", amount: "20.00", currency: "SGD" } });
    get.mockResolvedValue({ data: { data: [{ url: "https://hitpay.test/checkout" }] } });
  });

  describe("constructor / isSetupAlready", () => {
    it("parses valid credentials", () => {
      expect(new PaymentService({ key: validKey }).isSetupAlready()).toBe(true);
    });

    it("treats invalid credentials as not set up", () => {
      expect(new PaymentService({ key: { isSandbox: "nope" } }).isSetupAlready()).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a payment request via the HitPay API", async () => {
      const bookingId = 301;
      await seedApp();
      await seedBooking(bookingId);
      const service = new PaymentService({ key: validKey });

      const result = await callCreate(service, bookingId);

      expect(post).toHaveBeenCalledOnce();
      expect(get).toHaveBeenCalledOnce();
      expect(result).toEqual(
        expect.objectContaining({
          externalId: "hitpay-req-1",
          currency: "SGD",
          success: false,
        })
      );
      // 20.00 * 100
      expect(result.amount).toBe(2000);

      // read back so a failed `app: { connect: { slug } }` can't pass as a happy path
      const stored = await prismock.payment.findFirst({ where: { bookingId } });
      expect(stored?.externalId).toBe("hitpay-req-1");
    });

    it("cancels the booking and throws when the API key is missing for the environment", async () => {
      const bookingId = 302;
      await seedApp();
      await seedBooking(bookingId);
      // isSandbox true but no sandbox key object -> "API key not found"
      const service = new PaymentService({ key: { isSandbox: true } });

      await expect(callCreate(service, bookingId)).rejects.toThrow(ErrorCode.PaymentCreationFailure);

      const booking = await prismock.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe("CANCELLED");
    });

    it("throws PaymentCreationFailure when the booking does not exist", async () => {
      await seedApp();
      const bookingId = 303;
      await seedBooking(bookingId);
      const service = new PaymentService({ key: validKey });

      await expect(callCreate(service, 999)).rejects.toThrow(ErrorCode.PaymentCreationFailure);

      // the error-path booking.update must not touch an unrelated booking
      const untouched = await prismock.booking.findUnique({ where: { id: bookingId } });
      expect(untouched?.status).not.toBe("CANCELLED");
      expect(await prismock.payment.findFirst({ where: { bookingId: 999 } })).toBeNull();
    });
  });

  describe("unimplemented and no-op methods", () => {
    it("rejects unimplemented async methods", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.update()).rejects.toThrow("Method not implemented.");
      await expect(service.refund()).rejects.toThrow("Method not implemented.");
      await expect(service.collectCard(payment, 1, "booker@example.com", "ON_BOOKING")).rejects.toThrow(
        "Method not implemented"
      );
    });

    it("throws for unimplemented sync methods", () => {
      const service = new PaymentService({ key: validKey });
      expect(() => service.chargeCard(payment, 1)).toThrow("Method not implemented.");
      expect(() => service.getPaymentPaidStatus()).toThrow("Method not implemented.");
      expect(() => service.getPaymentDetails()).toThrow("Method not implemented.");
    });

    it("afterPayment resolves and deletePayment returns false", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(
        // @ts-expect-error test only needs the shape used by the method
        service.afterPayment({}, { id: 1, uid: "x", startTime: new Date(), user: null }, {})
      ).resolves.toBeUndefined();
      await expect(service.deletePayment(1)).resolves.toBe(false);
    });
  });
});
