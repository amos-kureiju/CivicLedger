export type ThemeMode = "light" | "dark";

export interface AppPalette {
  canvas: string;
  surface: string;
  card: string;
  nested: string;
  elevated: string;
  border: string;
  inkPrimary: string;
  inkBody: string;
  inkSecondary: string;
  inkMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  amber: string;
  amberSoft: string;
  rose: string;
  roseSoft: string;
}

export const LIGHT_PALETTE: AppPalette = {
  canvas: "#FAF7F2",
  surface: "#FFFDF9",
  card: "#FFFFFF",
  nested: "#F3ECE1",
  elevated: "#EBE3D5",
  border: "#DDD3C4",
  inkPrimary: "#1D2622",
  inkBody: "#333F39",
  inkSecondary: "#525F59",
  inkMuted: "#6D7872",
  primary: "#1B6B50",
  primaryText: "#FFFFFF",
  primarySoft: "#E6F4EE",
  amber: "#C2671D",
  amberSoft: "#FDF1E4",
  rose: "#C4363A",
  roseSoft: "#FDECEC",
};

export const DARK_PALETTE: AppPalette = {
  canvas: "#141917",
  surface: "#181E1B",
  card: "#1D2421",
  nested: "#252E2A",
  elevated: "#2E3A35",
  border: "#3D4C45",
  inkPrimary: "#F7F4EF",
  inkBody: "#E2DED7",
  inkSecondary: "#B8BFBA",
  inkMuted: "#8E9993",
  primary: "#4ED49E",
  primaryText: "#0F241C",
  primarySoft: "#1A352A",
  amber: "#F6B756",
  amberSoft: "#332818",
  rose: "#F99494",
  roseSoft: "#381F21",
};

export function getPalette(theme: ThemeMode): AppPalette {
  return theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}

export function fs(base: number, largeText: boolean): number {
  return Math.round(base * (largeText ? 1.18 : 1));
}
