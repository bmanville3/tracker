import {
  EditableExercise,
  EditableSet,
  EditableWorkout,
} from "@/src/api/workoutSharedApi";
import {
  Button,
  ClosableModal,
  ModalPicker,
  NumberField,
} from "@/src/components";
import { CalendarModal } from "@/src/components/CalendarModal";
import { isWithinRPERepRange, rpeChartE1RM } from "@/src/components/RPEChart";
import { colors, spacing, typography } from "@/src/theme";
import {
  DISTANCE_UNITS,
  DistanceUnit,
  LogPerformanceType,
  RPES,
  SET_TYPES,
  TIME_UNITS,
  WEIGHT_UNITS,
  WeightUnit,
} from "@/src/types";
import {
  capitalizeFirstLetter,
  changeDistanceUnit,
  changeTimeUnit,
  changeWeightUnit,
  todayISO,
} from "@/src/utils";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import {
  AdvancedSetRenderProps,
  HeaderSubFieldsProps,
  SetRenderProps,
  WorkoutEditorModeStrategy,
} from "./WorkoutView";

type SetUpdaterType = <K extends keyof EditableSet<"log">>(
  key: K,
  value: EditableSet<"log">[K],
) => void;
type BaseSetEditorCtx = {
  isLoading: boolean;
  allowEditing: boolean;
  set: EditableSet<"log">;
  handleUpdateSetCurried: SetUpdaterType;
};

function showField<T>(
  allowEditing: boolean,
  value: T | null | undefined,
): boolean {
  return allowEditing || (value !== null && value !== undefined);
}

function InlineRow(props: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const style = props.style ?? {};
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        },
        style,
      ]}
    >
      {props.children}
    </View>
  );
}

function Metric(props: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 10,
        padding: spacing.padding_sm,
        backgroundColor: colors.fadedPrimary,
      }}
    >
      <Text
        style={{
          ...typography.body,
          fontWeight: "700",
        }}
      >
        {props.children}
      </Text>
    </View>
  );
}

function weightChangerForSet(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set, handleUpdateSetCurried } = ctx;
  return (
    <NumberField
      numberValue={set.weight}
      placeholder="Weight"
      onChangeNumber={(value) => handleUpdateSetCurried("weight", value)}
      numberType={"float"}
      editable={!isLoading && allowEditing}
      style={{
        ...styles.textFieldBase,
        ...(allowEditing
          ? styles.editableTextField
          : styles.nonEditableTextField),
      }}
    />
  );
}

function duartionChangerForSet(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set, handleUpdateSetCurried } = ctx;
  return (
    <NumberField
      numberValue={set.duration}
      placeholder={set.time_unit}
      onChangeNumber={(value) => handleUpdateSetCurried("duration", value)}
      numberType={"float"}
      editable={!isLoading && allowEditing}
      style={{
        ...styles.textFieldBase,
        ...(allowEditing
          ? styles.editableTextField
          : styles.nonEditableTextField),
      }}
    />
  );
}

function distanceChangerForSet(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set } = ctx;
  return (
    <NumberField
      numberValue={set.distance_per_rep}
      placeholder="Dist."
      onChangeNumber={(value) =>
        ctx.handleUpdateSetCurried("distance_per_rep", value)
      }
      numberType="float"
      editable={!isLoading && allowEditing}
      style={{
        ...styles.textFieldBase,
        ...(allowEditing
          ? styles.editableTextField
          : styles.nonEditableTextField),
      }}
    />
  );
}

function repsChanger(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set, handleUpdateSetCurried } = ctx;
  return (
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
      style={{
        ...styles.textFieldBase,
        ...(allowEditing
          ? styles.editableTextField
          : styles.nonEditableTextField),
      }}
    />
  );
}

function weightUnitPickerForSet(ctx: Omit<BaseSetEditorCtx, "allowEditing">) {
  const { isLoading, set, handleUpdateSetCurried } = ctx;
  return (
    <ModalPicker
      options={WEIGHT_UNITS.map((u) => {
        return { label: u, value: u };
      })}
      value={set.weight_unit}
      onChange={(u) => {
        if (set.weight !== null) {
          handleUpdateSetCurried(
            "weight",
            changeWeightUnit(set.weight, set.weight_unit, u),
          );
        }
        handleUpdateSetCurried("weight_unit", u);
      }}
      disabled={isLoading} // allowing edit here on !allowEdit so we can change display
      pressableProps={{ style: [styles.pressableBase, styles.pressable] }}
    />
  );
}

function timeUnitPickerForSet(ctx: Omit<BaseSetEditorCtx, "allowEditing">) {
  const { isLoading, set, handleUpdateSetCurried } = ctx;
  return (
    <ModalPicker
      options={TIME_UNITS.map((u) => {
        return { label: u, value: u };
      })}
      value={set.time_unit}
      onChange={(u) => {
        if (set.duration !== null) {
          handleUpdateSetCurried(
            "duration",
            changeTimeUnit(set.duration, set.time_unit, u),
          );
        }
        handleUpdateSetCurried("time_unit", u);
      }}
      disabled={isLoading} // allowing edit here on !allowEdit so we can change display
      pressableProps={{ style: [styles.pressableBase, styles.pressable] }}
    />
  );
}

function distanceUnitPickerForSet(ctx: Omit<BaseSetEditorCtx, "allowEditing">) {
  const { isLoading, set, handleUpdateSetCurried } = ctx;
  return (
    <ModalPicker
      options={DISTANCE_UNITS.map((u) => ({ label: u, value: u }))}
      value={set.distance_unit}
      onChange={(u) => {
        if (set.distance_per_rep !== null) {
          handleUpdateSetCurried(
            "distance_per_rep",
            changeDistanceUnit(set.distance_per_rep, set.distance_unit, u),
          );
        }
        handleUpdateSetCurried("distance_unit", u);
      }}
      disabled={isLoading}
      pressableProps={{ style: [styles.pressableBase, styles.pressable] }}
    />
  );
}

function rpePickerForSet(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set, handleUpdateSetCurried } = ctx;
  return (
    <ModalPicker
      options={[
        ...RPES.map((r) => {
          return { label: r.toString(), value: r };
        }),
        { label: "RPE", value: null },
      ]}
      onChange={(value) => handleUpdateSetCurried("rpe", value)}
      pressableProps={{
        style: [
          styles.pressableBase,
          allowEditing ? styles.pressable : styles.nonPressable,
        ],
      }}
      disabled={isLoading || !allowEditing}
      value={set.rpe}
    />
  );
}

function subHeaderInAdvanced(text: string) {
  return (
    <Text
      style={{
        ...typography.subsection,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: spacing.sm,
        paddingBottom: spacing.padding_sm,
      }}
    >
      {text}
    </Text>
  );
}

function commonAdvancedHeader(
  ctx: BaseSetEditorCtx & {
    exercise: EditableExercise<"log">;
    exerciseIndex: number;
    setIndex: number;
  },
) {
  const { exercise, exerciseIndex, setIndex } = ctx;
  return (
    <>
      <Text
        style={{
          ...typography.section,
          borderBottomWidth: 2,
          borderBottomColor: colors.border,
          marginBottom: spacing.sm,
          paddingBottom: spacing.padding_sm,
        }}
      >
        Advanced Logging for {exercise.exercise.name} - Exercise{" "}
        {exerciseIndex + 1} - Set {setIndex + 1}
      </Text>
      {subHeaderInAdvanced("Type")}
      {commonPerformanceTypeSelection(ctx)}
      {commonSetTypeSelection(ctx)}
    </>
  );
}

function commonAdvancedFooter(ctx: {
  allowEditing: boolean;
  isLoading: boolean;
  exerciseIndex: number;
  setIndex: number;
  handleRemoveSetInExercise: (e: number, s: number) => void;
  onRequestClose: () => void;
}) {
  const {
    allowEditing,
    isLoading,
    exerciseIndex,
    setIndex,
    handleRemoveSetInExercise,
    onRequestClose,
  } = ctx;
  return (
    <View>
      <Button title="Close" onPress={onRequestClose} />
      {allowEditing && (
        <Button
          title="Delete Set"
          onPress={() => {
            handleRemoveSetInExercise(exerciseIndex, setIndex);
          }}
          variant="revert"
          disabled={!allowEditing || isLoading}
        />
      )}
    </View>
  );
}

function commonMoveOptions(ctx: {
  allowEditing: boolean;
  isLoading: boolean;
  totalSetsInExercise: number;
  setIndex: number;
  exerciseIndex: number;
  handleSwapSetsInExercise: (e: number, s1: number, s2: number) => void;
}) {
  const {
    allowEditing,
    isLoading,
    totalSetsInExercise,
    setIndex,
    exerciseIndex,
    handleSwapSetsInExercise,
  } = ctx;
  if (!allowEditing || totalSetsInExercise === 1) {
    return null;
  }
  return (
    <InlineRow>
      <Text style={{ ...typography.body, marginRight: spacing.md }}>
        Move Set:
      </Text>
      {setIndex !== 0 && (
        <Button
          title="&uarr;"
          onPress={() =>
            handleSwapSetsInExercise(exerciseIndex, setIndex, setIndex - 1)
          }
          variant="secondary"
          style={{ padding: 5 }}
          textProps={{ style: { fontSize: 12 } }}
          disabled={isLoading || !allowEditing}
        />
      )}
      {setIndex !== totalSetsInExercise - 1 && (
        <Button
          title="&darr;"
          onPress={() =>
            handleSwapSetsInExercise(exerciseIndex, setIndex, setIndex + 1)
          }
          variant="secondary"
          style={{ padding: 5 }}
          textProps={{ style: { fontSize: 12 } }}
          disabled={isLoading || !allowEditing}
        />
      )}
    </InlineRow>
  );
}

function commonSetTypeSelection(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set, handleUpdateSetCurried } = ctx;
  return (
    <InlineRow>
      <Text style={{ ...typography.body, marginRight: spacing.md }}>
        Set Type:
      </Text>
      <ModalPicker
        title="Pick Set Type"
        options={SET_TYPES.map((t) => {
          return {
            label: t !== null ? capitalizeFirstLetter(t) : "None",
            value: t,
          };
        })}
        value={set.set_type}
        onChange={(v) => handleUpdateSetCurried("set_type", v)}
        textProps={{ style: typography.body }}
        pressableProps={{
          style: [
            styles.pressableBase,
            allowEditing ? styles.pressable : styles.nonPressable,
          ],
        }}
        disabled={isLoading || !allowEditing}
      />
    </InlineRow>
  );
}

function commonPerformanceTypeSelection(ctx: BaseSetEditorCtx) {
  const { isLoading, allowEditing, set, handleUpdateSetCurried } = ctx;
  return (
    <InlineRow>
      <Text style={{ ...typography.body, marginRight: spacing.md }}>
        Performance Type:
      </Text>
      <ModalPicker
        title="Pick Performance Metrics for Set"
        options={
          [
            { value: "weight", label: "Weight Based" },
            { value: "movement", label: "Movement Based" },
          ] satisfies { value: LogPerformanceType; label: string }[]
        }
        value={set.performance_type}
        onChange={(v) => handleUpdateSetCurried("performance_type", v)}
        pressableProps={{
          style: [
            styles.pressableBase,
            allowEditing ? styles.pressable : styles.nonPressable,
          ],
        }}
        textProps={{ style: typography.body }}
        disabled={isLoading || !allowEditing}
      />
    </InlineRow>
  );
}

function renderWeightSet(ctx: SetRenderProps<"log">): React.JSX.Element | null {
  const { set, handleUpdateSetCurried, isLoading, allowEditing, ..._rest } =
    ctx;
  if (set.performance_type !== "weight") {
    console.error(`Tried to render ${JSON.stringify(set)} as weight based set`);
    return null;
  }
  const showWeight = showField(allowEditing, set.weight);
  const showReps = showField(allowEditing, set.reps);
  const showRpe = showField(allowEditing, set.rpe);

  const setNumber = <Text style={typography.hint}>{ctx.setIndex + 1}.</Text>;

  if (
    !(showReps || showWeight || showRpe) &&
    set.rest_seconds_before === null &&
    set.duration === null
  ) {
    return setNumber;
  }

  return (
    <View>
      {
        <InlineRow>
          {setNumber}
          {showWeight && weightChangerForSet(ctx)}
          {showWeight && weightUnitPickerForSet(ctx)}
          {showWeight && showReps && (
            <Text style={typography.body}>&times;</Text>
          )}
          {showReps && repsChanger(ctx)}
          {(showReps || showRpe) && (
            <Text style={typography.body}>
              {showReps ? "Reps" : ""}
              {showRpe && showReps ? " @ " : ""}
              {showRpe ? "RPE" : ""}
            </Text>
          )}
          {showRpe && rpePickerForSet(ctx)}
        </InlineRow>
      }
      {(set.rest_seconds_before !== null || set.duration !== null) && (
        <Text style={{ ...typography.hint, marginTop: spacing.sm }}>
          {set.rest_seconds_before !== null && (
            <>Rest Before: {set.rest_seconds_before} sec</>
          )}

          {set.rest_seconds_before !== null && set.duration !== null && ", "}

          {set.duration !== null && (
            <>
              Set Duration: {set.duration.toFixed(1)} {set.time_unit}
            </>
          )}
        </Text>
      )}
    </View>
  );
}

function renderAdvancedWeightSet(
  ctx: AdvancedSetRenderProps<"log">,
): React.JSX.Element | null {
  const {
    set,
    handleUpdateSetCurried,
    isLoading,
    allowEditing,
    isVisible,
    onRequestClose,
  } = ctx;
  if (set.performance_type !== "weight") {
    console.error(`Tried to render ${JSON.stringify(set)} as weight based set`);
    return null;
  }
  const e1rm =
    set.reps && set.weight && isWithinRPERepRange(set.reps)
      ? rpeChartE1RM(set.weight, set.reps, set.rpe)
      : null;
  const timePerRep =
    set.reps !== null && set.duration !== null ? set.duration / set.reps : null;
  return (
    <ClosableModal
      visible={isVisible}
      onRequestClose={onRequestClose}
      scrollViewProps={{ contentContainerStyle: { gap: spacing.md } }}
    >
      {commonAdvancedHeader(ctx)}

      {subHeaderInAdvanced("Options")}

      {commonMoveOptions(ctx)}
      <InlineRow>
        <Text style={{ ...typography.body, marginRight: spacing.md }}>
          Rest Before Set (seconds):
        </Text>
        <NumberField
          numberValue={set.rest_seconds_before}
          placeholder="sec"
          onChangeNumber={(value) =>
            handleUpdateSetCurried("rest_seconds_before", value)
          }
          numberType="int"
          style={{
            ...styles.textFieldBase,
            ...(allowEditing
              ? styles.editableTextField
              : styles.nonEditableTextField),
            width: 60,
          }}
          editable={!isLoading && allowEditing}
        />
      </InlineRow>
      <InlineRow>
        <Text style={{ ...typography.body, marginRight: spacing.md }}>
          Set Duration:
        </Text>
        {duartionChangerForSet(ctx)}
        {timeUnitPickerForSet(ctx)}
      </InlineRow>
      {subHeaderInAdvanced("Metrics")}
      {e1rm !== null ? (
        <View>
          <InlineRow>
            <Text style={typography.body}>Estimated One Rep Max (e1RM):</Text>
            <Metric>
              {e1rm.toFixed(1)} {set.weight_unit}
              {e1rm === 1 ? "" : "s"}
            </Metric>
          </InlineRow>
          {!set.rpe && (
            <Text style={typography.hint}>
              Used RPE 10 (max effort set).{"\n"}Add an RPE for a more precise
              estimation.
            </Text>
          )}
        </View>
      ) : (
        <Text style={typography.body}>
          Add weight and reps (1-12) to see your Estimated One Rep Max (e1RM).
        </Text>
      )}
      {timePerRep !== null && (
        <InlineRow>
          <Text style={typography.body}>Average Rep Speed:</Text>
          <Metric>
            {timePerRep.toFixed(1)} {set.time_unit}
            {timePerRep === 1 ? "" : "s"} / rep
          </Metric>
        </InlineRow>
      )}
      {commonAdvancedFooter(ctx)}
    </ClosableModal>
  );
}

function renderMovementSet(
  ctx: SetRenderProps<"log">,
): React.JSX.Element | null {
  const { set, allowEditing } = ctx;

  if (set.performance_type !== "movement") {
    console.error(
      `Tried to render ${JSON.stringify(set)} as movement based set`,
    );
    return null;
  }

  const showDistance = showField(allowEditing, set.distance_per_rep);
  const showDuration = showField(allowEditing, set.duration);

  return (
    <View>
      <InlineRow>
        <Text style={typography.hint}>{ctx.setIndex + 1}.</Text>

        {showDistance && (
          <>
            {distanceChangerForSet(ctx)}
            {distanceUnitPickerForSet(ctx)}
          </>
        )}

        {showDistance && set.reps !== null && (
          <Text style={typography.body}>&times;</Text>
        )}

        {set.reps !== null && (
          <Text style={typography.body}>{set.reps} Bouts</Text>
        )}

        {showDuration && (showDistance || set.reps !== null) && (
          <Text style={typography.body}>in</Text>
        )}

        {showDuration && (
          <>
            {duartionChangerForSet(ctx)}
            {timeUnitPickerForSet(ctx)}
          </>
        )}
      </InlineRow>
      {set.weight !== null && (
        <Text style={typography.hint}>
          With Weight: {set.weight}
          {set.weight_unit}
          {set.weight === 1 ? "s" : ""}
        </Text>
      )}
    </View>
  );
}

function renderAdvancedMovementSet(
  ctx: AdvancedSetRenderProps<"log">,
): React.JSX.Element | null {
  const { set, isVisible, onRequestClose } = ctx;
  if (set.performance_type !== "movement") {
    console.error(
      `Tried to render ${JSON.stringify(set)} as movement based set`,
    );
    return null;
  }
  const traveledDistance =
    set.distance_per_rep !== null
      ? set.distance_per_rep * (set.reps === null ? 1 : set.reps)
      : null;
  const loadDistance =
    traveledDistance !== null && set.weight !== null
      ? changeDistanceUnit(traveledDistance, set.distance_unit, "m") *
        changeWeightUnit(set.weight, set.weight_unit, "kg")
      : null;
  const boutsPerUnit =
    set.reps !== null && set.duration !== null ? set.reps / set.duration : null;
  return (
    <ClosableModal
      visible={isVisible}
      onRequestClose={onRequestClose}
      scrollViewProps={{ contentContainerStyle: { gap: spacing.md } }}
    >
      {commonAdvancedHeader(ctx)}

      {subHeaderInAdvanced("Options")}

      {commonMoveOptions(ctx)}

      <InlineRow>
        <Text style={{ ...typography.body, marginRight: spacing.md }}>
          With Weight:
        </Text>
        {weightChangerForSet(ctx)}
        {weightUnitPickerForSet(ctx)}
      </InlineRow>

      <InlineRow>
        <Text style={{ ...typography.body, marginRight: spacing.md }}>
          For Reps:
        </Text>
        {repsChanger(ctx)}
      </InlineRow>

      {subHeaderInAdvanced("Metrics")}

      {traveledDistance !== null && (
        <InlineRow>
          <Text style={typography.body}>Total Distance Traveled:</Text>
          <Metric>
            {traveledDistance.toFixed(1)} {set.distance_unit}
          </Metric>
          {set.duration !== null && (
            <Text style={typography.body}>
              in {set.duration.toFixed(1)} {set.time_unit}
            </Text>
          )}
        </InlineRow>
      )}
      {traveledDistance !== null && set.duration !== null && (
        <InlineRow>
          <Text style={typography.body}>Average Pace:</Text>
          <Metric>
            {(traveledDistance / set.duration).toFixed(1)} {set.distance_unit} /{" "}
            {set.time_unit}
          </Metric>
        </InlineRow>
      )}
      {boutsPerUnit !== null && (
        <InlineRow>
          <Text style={typography.body}>Average Bout Time:</Text>
          <Metric>
            {boutsPerUnit.toFixed(1)} Bout{boutsPerUnit === 1 ? "" : "s"} /{" "}
            {set.time_unit}
          </Metric>
        </InlineRow>
      )}
      {loadDistance !== null && (
        <InlineRow>
          <Text style={typography.body}>Total Load-Distance:</Text>
          <Metric>
            {loadDistance.toFixed(1)} kg{"\u00B7"}m
          </Metric>
        </InlineRow>
      )}
      {loadDistance !== null && set.duration !== null && (
        <InlineRow>
          <Text style={typography.body}>Load-Distance per Unit of Time:</Text>
          <Metric>
            {(loadDistance / set.duration).toFixed(1)} kg{"\u00B7"}m /{" "}
            {set.time_unit}
          </Metric>
        </InlineRow>
      )}

      {commonAdvancedFooter(ctx)}
    </ClosableModal>
  );
}

export const logWorkoutStrategy: WorkoutEditorModeStrategy<"log"> = {
  mode: "log",

  createEmptyWorkout(): EditableWorkout<"log"> {
    return {
      name: "",
      notes: "",
      bodyweight: null,
      bodyweight_unit: "kg",

      user_id: "",
      completed_on: todayISO(),

      program_row: null,
      block_in_program: null,
      week_in_block: null,
      day_in_week: null,
      workout_type: null,

      duration: null,
      duration_unit: "min",
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
      performance_type: "weight",

      percentage_of_max: null,
      max_percentage_exercise_id: null,

      reps: null,
      rpe: null,
      weight: null,
      rest_seconds_before: null,

      distance_per_rep: null,
      duration: null,
      time_unit: "sec",
    } satisfies EditableSet<"log">;
  },

  renderSetBody(ctx: SetRenderProps<"log">): React.JSX.Element | null {
    if (ctx.set.performance_type === "weight") {
      return renderWeightSet(ctx);
    } else if (ctx.set.performance_type === "movement") {
      return renderMovementSet(ctx);
    } else {
      console.error(`Cannot render set: ${ctx.set}`);
      return null;
    }
  },

  renderAdvancedSetMenu(
    ctx: AdvancedSetRenderProps<"log">,
  ): React.JSX.Element | null {
    if (ctx.set.performance_type === "weight") {
      return renderAdvancedWeightSet(ctx);
    } else if (ctx.set.performance_type === "movement") {
      return renderAdvancedMovementSet(ctx);
    } else {
      console.error(`Cannot render set: ${ctx.set}`);
      return null;
    }
  },
  renderWorkoutHeaderSubFields(
    ctx: HeaderSubFieldsProps<"log">,
  ): React.JSX.Element | null {
    const {
      workout,
      allowEditing,
      isLoading,
      handleUpdateWorkout,
      openDatePicker,
      setOpenDatePicker,
      newSetWeightUnit,
      setNewSetWeightUnit,
      newSetDistanceUnit,
      setNewSetDistanceUnit,
    } = ctx;
    return (
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: spacing.xs,
          }}
        >
          <Text style={typography.body}>Completed On:</Text>
          <Pressable
            onPress={() => setOpenDatePicker(!openDatePicker)}
            style={[
              styles.pressableBase,
              allowEditing ? styles.pressable : styles.nonPressable,
            ]}
            disabled={!allowEditing}
          >
            <Text style={typography.hint}>{workout.completed_on}</Text>
          </Pressable>
          {allowEditing && (
            <>
              <Text style={{ ...typography.body, marginLeft: spacing.md }}>
                New Set Units:
              </Text>
              <ModalPicker
                title="Default Weight Unit for Workout"
                options={WEIGHT_UNITS.map((u) => {
                  return { label: u, value: u };
                })}
                value={newSetWeightUnit}
                onChange={(u) => setNewSetWeightUnit(u)}
                pressableProps={{
                  style: [
                    styles.pressableBase,
                    allowEditing ? styles.pressable : styles.nonPressable,
                  ],
                }}
                textProps={{ style: typography.hint }}
                disabled={!allowEditing || isLoading}
              />
              <ModalPicker
                title="Default Distance Unit for Workout"
                options={DISTANCE_UNITS.map((u) => {
                  return { label: u, value: u };
                })}
                value={newSetDistanceUnit}
                onChange={(u) => setNewSetDistanceUnit(u)}
                pressableProps={{
                  style: [
                    styles.pressableBase,
                    allowEditing ? styles.pressable : styles.nonPressable,
                  ],
                }}
                textProps={{ style: typography.hint }}
                disabled={!allowEditing || isLoading}
              />
            </>
          )}
        </View>
        {/* Meta row: duration + bodyweight + units */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: spacing.sm,
          }}
        >
          <Text style={typography.body}>Duration:</Text>
          <NumberField
            numberValue={workout.duration}
            onChangeNumber={(value) => handleUpdateWorkout("duration", value)}
            numberType={"float"}
            placeholder={workout.duration_unit}
            placeholderTextColor={colors.placeholderTextColor}
            style={{
              ...styles.textFieldBase,
              ...(allowEditing
                ? styles.editableTextField
                : styles.nonEditableTextField),
              padding: 0,
              width: 60,
              borderBottomWidth: 1,
              textAlign: "center",
              marginLeft: spacing.sm,
            }}
            editable={!isLoading && allowEditing}
          />
          <ModalPicker
            options={TIME_UNITS.map((u) => {
              return { label: u, value: u };
            })}
            value={workout.duration_unit}
            onChange={(u) => {
              if (workout.duration !== null) {
                handleUpdateWorkout(
                  "duration",
                  changeTimeUnit(workout.duration, workout.duration_unit, u),
                );
              }
              handleUpdateWorkout("duration_unit", u);
            }}
            disabled={isLoading} // allowing edit here on !allowEdit so we can change display
            pressableProps={{
              style: {
                paddingVertical: spacing.padding_xs,
                paddingHorizontal: spacing.padding_sm,
              },
            }}
            textProps={{ style: typography.hint }}
          />
          <Text style={{ ...typography.body, marginLeft: spacing.md }}>
            Bodyweight:
          </Text>
          <NumberField
            numberValue={workout.bodyweight}
            onChangeNumber={(value) => handleUpdateWorkout("bodyweight", value)}
            placeholder={workout.bodyweight_unit}
            placeholderTextColor={colors.placeholderTextColor}
            style={{
              ...styles.textFieldBase,
              ...(allowEditing
                ? styles.editableTextField
                : styles.nonEditableTextField),
              padding: 0,
              width: 60,
              borderBottomWidth: 1,
              textAlign: "center",
              marginLeft: spacing.sm,
            }}
            numberType={"float"}
            editable={!isLoading && allowEditing}
          />
          <ModalPicker
            options={WEIGHT_UNITS.map((u) => {
              return { label: u, value: u };
            })}
            value={workout.bodyweight_unit}
            onChange={(u) => {
              if (workout.bodyweight !== null) {
                handleUpdateWorkout(
                  "bodyweight",
                  changeWeightUnit(
                    workout.bodyweight,
                    workout.bodyweight_unit,
                    u,
                  ),
                );
              }
              handleUpdateWorkout("bodyweight_unit", u);
            }}
            disabled={isLoading} // allowing edit here on !allowEdit so we can change display
            pressableProps={{
              style: {
                paddingVertical: spacing.padding_xs,
                paddingHorizontal: spacing.padding_sm,
              },
            }}
            textProps={{ style: typography.hint }}
          />
        </View>
        <CalendarModal
          visible={openDatePicker}
          onRequestClose={() => setOpenDatePicker(false)}
          selectedDate={workout.completed_on}
          onSelectDate={(date) => handleUpdateWorkout("completed_on", date)}
        />
      </View>
    );
  },
};

const styles = StyleSheet.create({
  pressableBase: {
    borderRadius: 10,
    paddingVertical: spacing.padding_md,
    paddingHorizontal: spacing.padding_md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressable: {
    backgroundColor: colors.surface,
  },
  nonPressable: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 0,
  },
  textFieldBase: {
    ...typography.body,
    padding: spacing.padding_md,
    maxWidth: 60,
  },
  editableTextField: {
    backgroundColor: colors.surface,
  },
  nonEditableTextField: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 0,
    textAlign: "left",
  },
});
