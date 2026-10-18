import { NextResponse } from "next/server";
import Stripe from "stripe";
import { saveOrder } from "../../../../lib/orders";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing session_id" }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, error: "Stripe key not configured" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        paymentStatus: session.payment_status,
        message: "Paiement non finalisé",
      });
    }

    const orderNumber = `PZ-STRIPE-${session.id.slice(-6).toUpperCase()}`;

    const order = {
      orderNumber,
      provider: "stripe",
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      status: "paid",
      createdAt: new Date(session.created * 1000).toISOString(),
      roomCode: session.metadata?.roomCode || "",
      puzzle: {
        sizeTitle: session.metadata?.sizeTitle || `${session.metadata?.pieces} pièces`,
        pieces: Number(session.metadata?.pieces || 252),
        dimensions: session.metadata?.dimensions || "",
        price: session.metadata?.price || (session.amount_total / 100).toFixed(2),
        imageUrl: session.metadata?.imageUrl || "",
      },
      buyer: {
        name: session.customer_details?.name || session.shipping_details?.name || "Client Puzzle",
        email: session.customer_details?.email || "",
        phone: session.customer_details?.phone || "",
        shippingAddress: session.shipping_details?.address || session.customer_details?.address || {},
      },
      amountTotal: (session.amount_total / 100).toFixed(2),
      currency: session.currency?.toUpperCase() || "EUR",
    };

    saveOrder(order);

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error("[Retrieve Stripe Session Error]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
