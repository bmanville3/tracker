import { Pressable, Text, View } from "react-native";
import { typography } from "../theme";

export function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? "#4f46e5" : "#9aa0a6",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        {selected && (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: "#4f46e5",
            }}
          />
        )}
      </View>

      <Text style={typography.body}>{label}</Text>
    </Pressable>
  );
}
