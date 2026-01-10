import { Button, Screen } from "@/src/components";
import { RpeTableModal } from "@/src/components/RPEChart";
import { useEffect, useState } from "react";

export default function Analytics() {
  const [displayRpeChart, setDisplayRpeChart] = useState<boolean>(false);

  useEffect(() => {
    setDisplayRpeChart(false);
  }, []);

  return (
    <Screen center={false}>
      <Button
        title={"RPE Calculator"}
        style={{ alignSelf: "flex-end" }}
        onPress={() => setDisplayRpeChart(true)}
      />
      <RpeTableModal
        visible={displayRpeChart}
        onRequestClose={() => setDisplayRpeChart(false)}
      />
    </Screen>
  );
}
