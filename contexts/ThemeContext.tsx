import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkColors,
  LightColors,
  darkPaperTheme,
  lightPaperTheme,
  makeInputTheme,
  type AppColors,
} from "../constants/theme";

interface ThemeContextType {
  isDark: boolean;
  colors: AppColors;
  paperTheme: typeof darkPaperTheme;
  inputTheme: ReturnType<typeof makeInputTheme>;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: DarkColors,
  paperTheme: darkPaperTheme,
  inputTheme: makeInputTheme(DarkColors),
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("theme").then((val) => {
      if (val === "light") setIsDark(false);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem("theme", next ? "dark" : "light");
  };

  const colors = isDark ? DarkColors : LightColors;
  const paperTheme = isDark ? darkPaperTheme : lightPaperTheme;
  const inputTheme = makeInputTheme(colors);

  return (
    <ThemeContext.Provider
      value={{ isDark, colors, paperTheme, inputTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext);
