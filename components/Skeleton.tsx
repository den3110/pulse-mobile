import React, { useEffect, useRef } from "react";
import { ViewStyle, Animated, StyleSheet, DimensionValue } from "react-native";
import { useAppTheme } from "../contexts/ThemeContext";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  style?: ViewStyle;
  borderRadius?: number;
}

export const Skeleton = ({
  width,
  height,
  style,
  borderRadius = 4,
}: SkeletonProps) => {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          backgroundColor: colors.surfaceVariant, // or a specific gray/skeleton color
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
};
