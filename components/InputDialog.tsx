import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import {
  Modal,
  Portal,
  Text,
  Button,
  TextInput,
  HelperText,
} from "react-native-paper";
import { useAppTheme } from "../contexts/ThemeContext"; // Import theme hook

interface InputDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  label?: string;
  initialValue?: string;
  onConfirm: (value: string) => void;
  loading?: boolean;
}

export default function InputDialog({
  visible,
  onDismiss,
  title,
  label = "Value",
  initialValue = "",
  onConfirm,
  loading = false,
}: InputDialogProps) {
  const [value, setValue] = useState(initialValue);
  const { colors } = useAppTheme(); // Get colors

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: colors.surface }, // Use theme surface color
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <TextInput
          label={label}
          value={value}
          onChangeText={setValue}
          mode="outlined"
          autoFocus={visible} // Only autofocus when visible to prevent keyboard flickering
          style={[styles.input, { backgroundColor: colors.surface }]}
          textColor={colors.text}
          theme={{ colors: { primary: colors.primary } }}
        />
        <View style={styles.actions}>
          <Button
            onPress={onDismiss}
            disabled={loading}
            textColor={colors.textSecondary}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={() => onConfirm(value)}
            loading={loading}
            disabled={loading}
            buttonColor={colors.primary}
            textColor={colors.surface}
          >
            Confirm
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
});
