import { Screen } from "@/src/components";
import { typography } from "@/src/theme";
import { Text } from "react-native";

export default function AboutScreen() {
  return (
    <Screen>
      <Text style={typography.title}>About screen</Text>
    </Screen>
  );
}
