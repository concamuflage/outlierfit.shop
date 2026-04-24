import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripeCheckoutOrderStatus } from "@/lib/server/orderPayments";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing Stripe session id." }, { status: 400 });
  }

  try {
    const status = await getStripeCheckoutOrderStatus(userId, sessionId);

    if (status.state === "not_found") {
      return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
    }

    if (status.state === "failed") {
      return NextResponse.json(
        {
          status: "failed",
          error: status.errorMessage ?? "Payment failed. Please try again.",
        },
        { status: 409 }
      );
    }

    if (status.state === "pending") {
      return NextResponse.json(
        {
          status: "pending",
          paymentStatus: status.paymentStatus,
          checkoutStatus: status.checkoutStatus,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      status: "completed",
      orderId: status.orderId,
      invoiceNumber: status.invoiceNumber,
      paidAt: status.paidAt,
    });
  } catch (error) {
    console.error("stripe checkout status error:", error);
    const message = error instanceof Error ? error.message : "Unable to load Stripe checkout status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
