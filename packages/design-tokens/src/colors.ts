export const colors = {
  primary: {
    50: "#eef5f1",
    100: "#d4e6db",
    200: "#a9cdb8",
    300: "#7cb293",
    400: "#549a76",
    500: "#2f6b4e",
    600: "#1f4f39",
    700: "#173d2c",
    800: "#102b1f",
    900: "#0a1c14",
  },
  accent: {
    100: "#dff5ec",
    300: "#a6e4cc",
    500: "#5fcba0",
    700: "#2f8f6c",
  },
  neutral: {
    0: "#ffffff",
    50: "#faf9f6",
    100: "#f2f1ec",
    200: "#e4e2da",
    300: "#cdcac0",
    400: "#a8a49a",
    500: "#7d7a72",
    600: "#5b584f",
    700: "#403d36",
    800: "#2a2823",
    900: "#181712",
  },
  slate: {
    500: "#5a6472",
    700: "#33394a",
    900: "#1a1e29",
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
} as const;

export type ColorToken = typeof colors;
