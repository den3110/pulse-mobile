import React, {
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { ScrollView, View, StyleSheet, Platform } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

export interface CustomAlertDialogRef {
  show: (title: string, content: string) => void;
  confirm: (
    title: string,
    content: string,
    onConfirm: () => void,
    confirmLabel?: string,
    isDestructive?: boolean,
  ) => void;
  hide: () => void;
}

const CustomAlertDialog = forwardRef<CustomAlertDialogRef, {}>((props, ref) => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    content: string;
    actions: {
      label: string;
      onPress: () => void;
      textColor?: string;
    }[];
  }>({ title: "", content: "", actions: [] });

  useImperativeHandle(ref, () => ({
    show: (title: string, content: string) => {
      setConfig({
        title,
        content,
        actions: [
          {
            label: "OK",
            onPress: () => setVisible(false),
          },
        ],
      });
      setVisible(true);
    },
    confirm: (
      title: string,
      content: string,
      onConfirm: () => void,
      confirmLabel = "Confirm",
      isDestructive = false,
    ) => {
      setConfig({
        title,
        content,
        actions: [
          {
            label: "Cancel",
            onPress: () => setVisible(false),
            textColor: theme.colors.elevation?.level3
              ? theme.colors.onSurfaceDisabled
              : theme.colors.backdrop, // approximate secondary color
          },
          {
            label: confirmLabel,
            onPress: () => {
              onConfirm();
              setVisible(false);
            },
            textColor: isDestructive
              ? theme.colors.error
              : theme.colors.primary,
          },
        ],
      });
      setVisible(true);
    },
    hide: () => setVisible(false),
  }));

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => setVisible(false)}>
        <Dialog.Title>{config.title}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
            <Text variant="bodyMedium">{config.content}</Text>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          {config.actions.map((action, index) => (
            <Button
              key={index}
              onPress={action.onPress}
              textColor={action.textColor}
            >
              {action.label}
            </Button>
          ))}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

export default CustomAlertDialog;
