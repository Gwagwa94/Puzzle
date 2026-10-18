import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ordersFilePath = path.join(process.cwd(), "data", "orders.json");

function ensureOrdersFile() {
  const dir = path.dirname(ordersFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(ordersFilePath)) {
    fs.writeFileSync(ordersFilePath, JSON.stringify([], null, 2), "utf8");
  }
}

export async function GET() {
  try {
    ensureOrdersFile();
    const data = fs.readFileSync(ordersFilePath, "utf8");
    const orders = JSON.parse(data || "[]");
    return NextResponse.json({ success: true, count: orders.length, orders });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    ensureOrdersFile();

    const data = fs.readFileSync(ordersFilePath, "utf8");
    const orders = JSON.parse(data || "[]");

    const orderNumber = `PZ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const newOrder = {
      orderNumber,
      paypalOrderId: body.paypalOrderId || `SIM-${Date.now()}`,
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

    orders.unshift(newOrder);
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf8");

    console.log(`[Puzzle Order] New order placed: ${orderNumber} - ${body.sizeTitle} (${body.price}€)`);

    return NextResponse.json({
      success: true,
      orderNumber,
      order: newOrder,
    });
  } catch (err) {
    console.error("[Puzzle Order] Error saving order:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
