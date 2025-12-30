import { Button, Screen } from "@/src/components";
import { ExerciseModal } from "@/src/components/ExerciseModal";
import { useState } from "react";

export default function HomeScreen() {
  const [openExerciseEditor, setOpenExerciseEditor] = useState<boolean>(false);
  return (
    <Screen>
      <Button
        title={"Exercise Catalog"}
        onPress={() => setOpenExerciseEditor(true)}
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
      ></ExerciseModal>
    </Screen>
  );
}
