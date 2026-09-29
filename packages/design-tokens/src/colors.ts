export const colors = {
  primary: {
    50: "#eef4fc",
    100: "#d9e8f9",
    200: "#b3d1f3",
    300: "#7fb2ea",
    400: "#4a8fdc",
    500: "#2569c7",
    600: "#1a52a3",
    700: "#163f7d",
    800: "#142f5c",
    900: "#0f2140",
  },
  accent: {
    100: "#d7f5f2",
    300: "#8fe3da",
    500: "#2bb8ab",
    700: "#1c8a80",
  },
  neutral: {
    0: "#ffffff",
    50: "#f6f8fb",
    100: "#eef2f7",
    200: "#dde5ee",
    300: "#c3d0dd",
    400: "#97a8ba",
    500: "#71829d",
    600: "#52627a",
    700: "#3a4759",
    800: "#26303f",
    900: "#161d29",
  },
  slate: {
    500: "#52627a",
    700: "#2c3648",
    900: "#131a26",
  },
  warning: {
    100: "#fdf1d8",
    500: "#c98a1f",
    700: "#8f5f0e",
  },
  danger: {
    100: "#fbe1de",
    500: "#c14634",
    700: "#8f2f22",
  },
  // Environmental canvas behind the white content surfaces: near-white at the
  // top, a light cool-blue tint toward the lower edge. Cards stay white.
  canvas: {
    top: "#f5f9fe",
    mid: "#eaf2fc",
    bottom: "#e3edf9",
  },
  chart: {
    blue: "#2569c7",
    teal: "#2bb8ab",
    amber: "#c98a1f",
  },
} as const;

export type ColorToken = typeof colors;
