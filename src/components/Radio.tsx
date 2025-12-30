import { colors, typography } from "@/src/theme";
import { Pressable, PressableProps, Text, View } from "react-native";

type RadioRowProps = PressableProps & {
  label: string;
  selected: boolean;
  radius?: number;
};

export function RadioRow({
  label,
  selected,
  radius = 20,
  ...props
}: RadioRowProps) {
  return (
    <Pressable
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
      }}
      {...props}
    >
      <View
        style={{
          width: radius,
          height: radius,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: selected ? colors.selection : "#9aa0a6",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        {selected && (
          <View
            style={{
              width: radius / 2,
              height: radius / 2,
              borderRadius: 999,
              backgroundColor: colors.selection,
            }}
          />
        )}
      </View>

      <Text style={typography.body}>{label}</Text>
    </Pressable>
  );
}
