import { EditablePerformanceType, EditableSet, EditableWorkout, WorkoutEditorMode } from "@/src/api/workoutSharedApi";
import { ModalPicker, NumberField } from "@/src/components";
import { spacing, typography } from "@/src/theme";
import { DistanceUnit, RPES, WEIGHT_UNITS, WeightUnit } from "@/src/types";
import { changeWeightUnit, todayISO } from "@/src/utils";
import { StyleSheet, Text, View } from "react-native";
import { WorkoutEditorModeStrategy } from "./WorkoutView";

export const logWorkoutStrategy: WorkoutEditorModeStrategy<"log"> = {
  mode: "log",

  getPerformanceTypes(): {label: string, value: EditablePerformanceType<'log'>}[] {
      return [{value: 'weight', label: 'Weight Based'}]
  },

  createEmptyWorkout(): EditableWorkout<"log"> {
    return {
      name: "",
      notes: "",
      bodyweight_kg: null,

      user_id: "",
      completed_on: todayISO(),
      duration_seconds: null,

      program_row: null,
      block_in_program: null,
      week_in_block: null,
      day_in_week: null,
      workout_type: null,
    } satisfies EditableWorkout<"log">;
  },

  createEmptySet(ctx: {
    weightUnit: WeightUnit;
    distanceUnit: DistanceUnit;
  }): EditableSet<"log"> {
    const { weightUnit, distanceUnit } = ctx;

    return {
      weight_unit: weightUnit,
      distance_unit: distanceUnit,
      set_type: null,
      duration_seconds: null,
      performance_type: "weight",

      percentage_of_max: null,
      max_percentage_exercise_id: null,

      reps: null,
      rpe: null,
      weight: null,
      rest_seconds_before: null,

      is_complete: false,
      distance_per_rep: null,
    } satisfies EditableSet<"log">;
  },

  renderSetBody(ctx: {
    set: EditableSet<'log'>,
    setIndex: number,
    handleUpdateSetCurried: <K extends keyof EditableSet<WorkoutEditorMode>> (key: K, value: EditableSet<WorkoutEditorMode>[K]) => void,
    isLoading: boolean,
    allowEditing: boolean,
  }): React.JSX.Element {
    const { set, handleUpdateSetCurried, isLoading, allowEditing } = ctx;
    return <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      <Text style={typography.hint}>{ctx.setIndex + 1}.</Text>
      <NumberField
        numberValue={set.weight}
        placeholder="Weight"
        onChangeNumber={(value) =>
          handleUpdateSetCurried("weight", value)
        }
        numberType={"float"}
        editable={!isLoading && allowEditing}
        style={{ padding: spacing.padding_md, width: 65 }}
      />
      <ModalPicker
        options={WEIGHT_UNITS.map((u) => {return {label: u, value: u}})}
        value={set.weight_unit}
        onChange={(u) => {
          if (set.weight !== null) {
            handleUpdateSetCurried('weight', changeWeightUnit(set.weight, set.weight_unit, u));
          }
          handleUpdateSetCurried("weight_unit", u);
        }}
        disabled={isLoading} // allowing edit here on !allowEdit so we can change display
        pressableProps={{ style: styles.pressable }}
      />
      <Text style={typography.body}>&times;</Text>
      <NumberField
        numberValue={set.reps}
        placeholder="Reps"
        onChangeNumber={(value) => {
          if (value !== null && value < 0) {
            return;
          }
          handleUpdateSetCurried("reps", value);
        }}
        numberType="float"
        editable={!isLoading && allowEditing}
        style={{ padding: spacing.padding_md, width: 50 }}
      />
      <Text style={typography.body}>Reps @ RPE</Text>
      <ModalPicker
        options={[...RPES.map(r => {return {label: r.toString(), value: r}}), {label: 'RPE', value: null}]}
        onChange={(value) => handleUpdateSetCurried("rpe", value)}
        pressableProps={{ style: styles.pressable }}
        disabled={isLoading || !allowEditing}
        value={set.rpe}
      />
    </View>;
  },
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 10,
    paddingVertical: spacing.padding_md,
    paddingHorizontal: spacing.padding_md,
  },
})
