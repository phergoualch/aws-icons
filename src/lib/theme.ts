import { createContext, useContext } from "react";

export type Theme = "light" | "dark";

export const ThemeContext = createContext<Theme>("dark");

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
