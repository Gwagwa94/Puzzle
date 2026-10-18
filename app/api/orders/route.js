import { NextResponse } from "next/server";
import { getAllOrders, saveOrder } from "../../../lib/orders";

export async function GET() {
  try {
    const orders = getAllOrders();
    return NextResponse.json({ success: true, count: orders.length, orders });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const orderNumber = `PZ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const newOrder = {
      orderNumber,
      provider: body.provider || "stripe_simulation",
      stripeSessionId: body.stripeSessionId || null,
      status: "paid",
      createdAt: new Date().toISOString(),
      roomCode: body.roomCode || "",
      puzzle: {
        sizeTitle: body.sizeTitle,
        pieces: body.pieces,
        dimensions: body.dimensions,
        price: body.price,
        imageUrl: body.imageUrl,
      },
      buyer: {
        name: body.buyerName || "Client Puzzle",
        email: body.buyerEmail || "",
        shippingAddress: body.shippingAddress || {},
      },
    };

    saveOrder(newOrder);
    console.log(`[Order Recorded] ${orderNumber} - ${body.sizeTitle} (${body.price}€)`);

    return NextResponse.json({
      success: true,
      orderNumber,
      order: newOrder,
    });
  } catch (err) {
    console.error("[Order Recording Error]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
