import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined) {
  if (date == null || date === "") return "—";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
