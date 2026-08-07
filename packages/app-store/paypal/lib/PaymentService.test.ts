import prismock from "../../../../tests/libs/__mocks__/prisma";

import type { Prisma } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ErrorCode } from "@calcom/lib/errorCodes";

import { PaymentService } from "./PaymentService";

const createOrder = vi.fn();

vi.mock("@calcom/app-store/paypal/lib/Paypal", () => ({
  default: vi.fn().mockImplementation(() => ({ createOrder })),
}));

const validKey = {
  client_id: "client_1",
  secret_key: "secret_1",
  webhook_id: "wh_1",
};

const payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency"> = {
  amount: 5000,
  currency: "usd",
};

async function seedBookingAndApp(bookingId: number) {
  await prismock.app.create({
    data: { slug: "paypal", dirName: "paypal", categories: ["payment"], enabled: true },
  });
  await prismock.booking.create({
    data: {
      id: bookingId,
      uid: `booking-${bookingId}`,
      title: "Paid meeting",
      startTime: new Date(),
      endTime: new Date(),
    },
  });
}

describe("Paypal PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOrder.mockResolvedValue({ id: "paypal-order-1" });
  });

  describe("constructor / isSetupAlready", () => {
    it("parses valid credentials", () => {
      expect(new PaymentService({ key: validKey }).isSetupAlready()).toBe(true);
    });

    it("treats invalid credentials as not set up", () => {
      expect(new PaymentService({ key: {} }).isSetupAlready()).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a pending payment from a PayPal order", async () => {
      const bookingId = 201;
      await seedBookingAndApp(bookingId);
      const service = new PaymentService({ key: validKey });

      const result = await service.create(payment, bookingId);

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amount: payment.amount, currency: payment.currency })
      );
      expect(result).toEqual(
        expect.objectContaining({
          amount: payment.amount,
          currency: payment.currency,
          externalId: "paypal-order-1",
          success: false,
        })
      );

      // read back so a failed `app: { connect: { slug } }` can't pass as a happy path
      const stored = await prismock.payment.findFirst({ where: { bookingId } });
      expect(stored?.externalId).toBe("paypal-order-1");
    });

    it("throws PaymentCreationFailure when the booking is missing", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.create(payment, 999)).rejects.toThrow(ErrorCode.PaymentCreationFailure);
    });

    it("throws PaymentCreationFailure when credentials are invalid", async () => {
      const bookingId = 202;
      await seedBookingAndApp(bookingId);
      const service = new PaymentService({ key: {} });
      await expect(service.create(payment, bookingId)).rejects.toThrow(ErrorCode.PaymentCreationFailure);
    });
  });

  describe("collectCard", () => {
    it("rejects ON_BOOKING because only HOLD is supported", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.collectCard(payment, 1, "ON_BOOKING")).rejects.toThrow(
        "Payment option is not compatible with create method"
      );
    });
  });

  describe("unimplemented and no-op methods", () => {
    it("rejects unimplemented async methods", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.update()).rejects.toThrow("Method not implemented.");
      await expect(service.refund()).rejects.toThrow("Method not implemented.");
    });

    it("throws for unimplemented sync methods", () => {
      const service = new PaymentService({ key: validKey });
      expect(() => service.chargeCard()).toThrow("Method not implemented.");
      expect(() => service.getPaymentPaidStatus()).toThrow("Method not implemented.");
      expect(() => service.getPaymentDetails()).toThrow("Method not implemented.");
    });

    it("afterPayment resolves and deletePayment returns false", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.afterPayment()).resolves.toBeUndefined();
      await expect(service.deletePayment()).resolves.toBe(false);
    });
  });
});
