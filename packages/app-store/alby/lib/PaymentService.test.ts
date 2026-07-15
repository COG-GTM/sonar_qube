import prismock from "../../../../tests/libs/__mocks__/prisma";

import type { Prisma } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ErrorCode } from "@calcom/lib/errorCodes";

import { PaymentService } from "./PaymentService";

const requestInvoice = vi.fn();
const fetchLightningAddress = vi.fn();

vi.mock("@getalby/lightning-tools", () => ({
  LightningAddress: vi.fn().mockImplementation(() => ({
    fetch: fetchLightningAddress,
    requestInvoice,
  })),
}));

const validKey = {
  account_id: "acc_1",
  account_email: "merchant@example.com",
  account_lightning_address: "merchant@getalby.com",
  webhook_endpoint_id: "we_1",
  webhook_endpoint_secret: "secret",
};

async function seedBookingAndApp(bookingId: number) {
  await prismock.app.create({
    data: { slug: "alby", dirName: "alby", categories: ["payment"], enabled: true },
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

const payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency"> = {
  amount: 1000,
  currency: "usd",
};

describe("Alby PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLightningAddress.mockResolvedValue(undefined);
    requestInvoice.mockResolvedValue({ paymentRequest: "lnbc-invoice" });
  });

  describe("constructor / isSetupAlready", () => {
    it("parses valid credentials and reports setup complete", () => {
      const service = new PaymentService({ key: validKey });
      expect(service.isSetupAlready()).toBe(true);
    });

    it("treats invalid credentials as not set up", () => {
      const service = new PaymentService({ key: { foo: "bar" } });
      expect(service.isSetupAlready()).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a pending payment with the invoice from the lightning address", async () => {
      const bookingId = 101;
      await seedBookingAndApp(bookingId);
      const service = new PaymentService({ key: validKey });

      const result = await service.create(payment, bookingId);

      expect(fetchLightningAddress).toHaveBeenCalledOnce();
      expect(requestInvoice).toHaveBeenCalledWith(expect.objectContaining({ satoshi: payment.amount }));
      expect(result).toEqual(
        expect.objectContaining({
          amount: payment.amount,
          currency: payment.currency,
          externalId: "lnbc-invoice",
          success: false,
          refunded: false,
        })
      );

      const stored = await prismock.payment.findFirst({ where: { bookingId } });
      expect(stored?.externalId).toBe("lnbc-invoice");
    });

    it("throws PaymentCreationFailure when the booking does not exist", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.create(payment, 999)).rejects.toThrow(ErrorCode.PaymentCreationFailure);
    });

    it("throws PaymentCreationFailure when credentials are missing the lightning address", async () => {
      const bookingId = 102;
      await seedBookingAndApp(bookingId);
      const service = new PaymentService({ key: { foo: "bar" } });
      await expect(service.create(payment, bookingId)).rejects.toThrow(ErrorCode.PaymentCreationFailure);
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
