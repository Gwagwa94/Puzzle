import fs from "fs";
import path from "path";

const ordersFilePath = path.join(process.cwd(), "data", "orders.json");

export function ensureOrdersFile() {
  const dir = path.dirname(ordersFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(ordersFilePath)) {
    fs.writeFileSync(ordersFilePath, JSON.stringify([], null, 2), "utf8");
  }
}

export function getAllOrders() {
  ensureOrdersFile();
  const raw = fs.readFileSync(ordersFilePath, "utf8");
  return JSON.parse(raw || "[]");
}

export function saveOrder(order) {
  ensureOrdersFile();
  const orders = getAllOrders();
  // Check if order already recorded to avoid duplicate entries
  const existingIdx = orders.findIndex(
    (o) =>
      o.orderNumber === order.orderNumber ||
      (order.stripeSessionId && o.stripeSessionId === order.stripeSessionId)
  );
  if (existingIdx >= 0) {
    orders[existingIdx] = { ...orders[existingIdx], ...order };
  } else {
    orders.unshift(order);
  }
  fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf8");
  return order;
}
