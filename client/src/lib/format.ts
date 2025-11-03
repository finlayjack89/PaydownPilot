// Utility functions for formatting currency and numbers

export function formatCurrency(cents: number, currency?: string | null): string {
  const amount = cents / 100;
  
  const currencySymbols: Record<string, string> = {
    USD: "$",
    GBP: "£",
    EUR: "€",
    CAD: "CA$",
    AUD: "AU$",
  };

  // Default to USD if currency is null/undefined
  const safeCurrency = currency || "USD";
  const symbol = currencySymbols[safeCurrency] || safeCurrency + " ";
  
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseCurrencyToCents(value: string): number {
  // Remove currency symbols and commas
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

export function formatPercentage(bps: number): string {
  const percentage = bps / 100;
  return `${percentage.toFixed(2)}%`;
}

export function formatBpsInput(value: string): number {
  // Parse percentage input (e.g., "24.99" -> 2499 bps)
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthYear(monthIndex: number, startDate: Date): string {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + monthIndex);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}
