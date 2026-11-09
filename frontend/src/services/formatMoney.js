export function formatMoney(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "Not available";
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
