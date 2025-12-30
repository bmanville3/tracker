import { colors, typography } from "@/src/theme";
import {
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  TextProps,
  ViewStyle,
} from "react-native";

type SelectionProps = Omit<PressableProps, "style"> & {
  title: string;
  isSelected: boolean;
  /** Extra props to pass to the inner Text (including style) */
  textProps?: TextProps;
  /** Optional style for the outer Pressable */
  style?: StyleProp<ViewStyle>;
};

export function Selection(props: SelectionProps) {
  const { title, isSelected, style, textProps, ...pressableRest } = props;
  const { style: textStyle, ...textRest } = textProps ?? {};

  return (
    <Pressable
      {...pressableRest}
      style={[
        {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: isSelected ? colors.selection : colors.border,
          backgroundColor: isSelected ? colors.selectionBg : "transparent",
        },
        style,
      ]}
    >
      <Text
        {...textRest}
        style={[
          typography.hint,
          {
            color: isSelected ? colors.selection : colors.textSecondary,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
