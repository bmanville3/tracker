import { Button, Screen } from "@/src/components";
import { RpeTableModal } from "@/src/screens/RPEChart";
import { ExerciseModal } from "@/src/screens/exercise/ExerciseModal";
import { useState } from "react";

export default function HomeScreen() {
  const [displayRpeChart, setDisplayRpeChart] = useState<boolean>(false);
  const [openExerciseEditor, setOpenExerciseEditor] = useState<boolean>(false);

  return (
    <Screen>
      <Button
        title={"Exercise Catalog"}
        onPress={() => setOpenExerciseEditor(true)}
      />
      <Button
        title={"RPE Calculator"}
        onPress={() => setDisplayRpeChart(true)}
      />
      <ExerciseModal
        allowCreateExercises={true}
        allowEditExercises={true}
        allowDeleteExercises={true}
        allowSelectExercises={false}
        visible={openExerciseEditor}
        onRequestClose={() => {
          setOpenExerciseEditor(false);
        }}
      />
      <RpeTableModal
        visible={displayRpeChart}
        onRequestClose={() => setDisplayRpeChart(false)}
      />
    </Screen>
  );
}
