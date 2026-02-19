import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getDarkColors,
  getLightColors,
  getPaperTheme,
  makeInputTheme,
  type AppColors,
} from "../constants/theme";

interface ThemeContextType {
  isDark: boolean;
  primaryColor: string;
  colors: AppColors;
  paperTheme: ReturnType<typeof getPaperTheme>;
  inputTheme: ReturnType<typeof makeInputTheme>;
  toggleTheme: () => void;
  setPrimaryColor: (color: string) => void;
}

const DEFAULT_PRIMARY = "#6366f1";

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  primaryColor: DEFAULT_PRIMARY,
  colors: getDarkColors(DEFAULT_PRIMARY),
  paperTheme: getPaperTheme(true, DEFAULT_PRIMARY),
  inputTheme: makeInputTheme(getDarkColors(DEFAULT_PRIMARY)),
  toggleTheme: () => {},
  setPrimaryColor: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [primaryColor, setPrimaryColorState] = useState(DEFAULT_PRIMARY);

  useEffect(() => {
    // Load theme mode
    AsyncStorage.getItem("theme").then((val) => {
      if (val === "light") setIsDark(false);
    });
    // Load primary color
    AsyncStorage.getItem("primaryColor").then((val) => {
      if (val) setPrimaryColorState(val);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem("theme", next ? "dark" : "light");
  };

  const setPrimaryColor = async (color: string) => {
    setPrimaryColorState(color);
    await AsyncStorage.setItem("primaryColor", color);
  };

  const colors = isDark
    ? getDarkColors(primaryColor)
    : getLightColors(primaryColor);
  const paperTheme = getPaperTheme(isDark, primaryColor);
  const inputTheme = makeInputTheme(colors);

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        primaryColor,
        colors,
        paperTheme,
        inputTheme,
        toggleTheme,
        setPrimaryColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext);
