import { VoucherStatus } from "./types";

export function formatRupiah(amount: number): string {
  const num = Math.round(Number(amount) || 0);
  const formatted = num
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${formatted}`;
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const day = String(d.getDate()).padStart(2, "0");
    const mon = months[d.getMonth()] || "";
    const yr = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${mon} ${yr}, ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

export function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm} WIB`;
  } catch {
    return iso;
  }
}

export function formatStatusLabel(status: VoucherStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Siap Pakai";
    case "REDEEMED":
      return "Sudah Dipakai";
    case "SETTLED":
      return "Sudah Cair";
    case "EXPIRED":
      return "Kedaluwarsa";
  }
}
