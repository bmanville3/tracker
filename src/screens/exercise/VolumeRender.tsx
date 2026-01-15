import { ActivityIndicator, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";
import { ExerciseMuscleRow, ExerciseRow, MUSCLE_GROUPS, MuscleGroup, MuscleGroupRow } from "../../types";
import { useEffect, useRef, useState } from "react";
import { Button, ModalPicker, TextField } from "../../components";
import { anyErrorToString, requireGetUser, showAlert } from "../../utils";
import { addExerciseMuscleVolume, deleteExerciseMuscleVolume, fetchExerciseMuscleVolumes, searchExercises, updateExerciseMuscleVolume } from "../../api/exerciseApi";
import { fetchMuscleGroups } from "../../api/muscleApi";

type VolumeEntry = {
  existing_db_row: ExerciseMuscleRow | null;
  new_value: number | null;
  remove_existing_db_row: boolean;
};

type VolumeByMuscle = Record<MuscleGroup, VolumeEntry>;

function volumeEntryEqual(a: VolumeEntry, b: VolumeEntry): boolean {
  if (a === b) return true;

  if (a.existing_db_row === null && b.existing_db_row !== null) return false;
  if (a.existing_db_row !== null && b.existing_db_row === null) return false;
  if (
    a.existing_db_row !== null &&
    b.existing_db_row !== null &&
    a.existing_db_row.id !== b.existing_db_row.id
  )
    return false;

  if (a.new_value !== b.new_value) return false;
  if (a.remove_existing_db_row !== b.remove_existing_db_row) return false;

  return true;
}

function volumeByMuscleEqual(
  v1: VolumeByMuscle | null,
  v2: VolumeByMuscle | null,
): boolean {
  if (v1 === v2) return true;
  if (v1 === null || v2 === null) return false;

  for (const mg of MUSCLE_GROUPS) {
    if (!volumeEntryEqual(v1[mg], v2[mg])) {
      return false;
    }
  }

  return true;
}

export type VolumeRenderProps = {
  exercise: ExerciseRow;
  onRequestClose: () => void;
  allowEditing?: boolean;
}

export function VolumeRender(props: VolumeRenderProps) {
  const { exercise, onRequestClose, allowEditing = true } = props;
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [loadingVolumes, setLoadingVolumes] = useState(false);
  const [volumeByMuscle, setVolumeByMuscle] = useState<VolumeByMuscle | null>(null);
  const [muscleGroupsToRender, setMuscleGroupsToRender] = useState<
    MuscleGroup[]
  >([]);
  const initialVolumeValuesRef = useRef<VolumeByMuscle | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<Map<MuscleGroup, MuscleGroupRow>>(new Map());

  const [showCopyFromOther, setShowCopyFromOther] = useState<boolean>(false);
  const [copyFromOtherSearch, setCopyFromOtherSearch] = useState<string>("");
  const [copyFromOtherOptions, setCopyFromOtherOptions] = useState<ExerciseRow[]>([]);

  const loadAll = async () => {
    setMuscleGroups(await fetchMuscleGroups());
    await loadVolumesForExercise();
  };

  useEffect(() => {
    void loadAll();
  }, [])

  const loadVolumesForExercise = async () => {
    setLoadingVolumes(true);
    setVolumeError(null);
    try {
      const user = await requireGetUser();
      if (!user) return;

      const map = await fetchExerciseMuscleVolumes(exercise.id, user.user_id);

      const records: VolumeByMuscle = MUSCLE_GROUPS.reduce((acc, mg) => {
        acc[mg] = {
          existing_db_row: map.get(mg) ?? null,
          new_value: null,
          remove_existing_db_row: false,
        };
        return acc;
      }, {} as VolumeByMuscle);
      setMuscleGroupsToRender([...map.keys()]);
      setVolumeByMuscle(records);
      initialVolumeValuesRef.current = records;
    } catch (e: any) {
      setVolumeByMuscle(null);
      setVolumeError(e?.message ?? "Failed to load muscle volumes");
    } finally {
      setLoadingVolumes(false);
    }
  };

  const updateVolumeField = (
    muscleId: MuscleGroup,
    new_value: number | null,
    remove_existing_db_row: boolean,
  ) => {
    if (!allowEditing) return;
    setVolumeByMuscle((prev) => {
      if (prev === null) {
        return prev;
      }

      const newVolumeEntry: VolumeEntry = {
        ...prev[muscleId],
        new_value: new_value,
        remove_existing_db_row: remove_existing_db_row,
      };

      const newState: VolumeByMuscle = {
        ...prev,
        [muscleId]: newVolumeEntry,
      };
      return newState;
    });
  };

  const handleSaveVolumes = async () => {
    if (!allowEditing) return;
    if (!volumeByMuscle) return;
    setLoadingVolumes(true);
    setVolumeError(null);
    try {
      const user = await requireGetUser();
      if (!user) return;

      if (
        Object.values(volumeByMuscle).some(
          (volumeRow) => {
            if (
              volumeRow.new_value !== null &&
              (volumeRow.new_value < 0 || volumeRow.new_value > 1)
            ) {
              showAlert(
                `Volume must be between 0 and 1. Got ${volumeRow.new_value}`,
              );
              return true;
            }
            return false;
          },
        )
      ) {
        return;
      }

      for (const [muscleId, volumeRow] of Object.entries(
        volumeByMuscle,
      )) {
        // nothing to update
        if (volumeRow.new_value === null && !volumeRow.remove_existing_db_row) {
          continue;
        }
        if (volumeRow.remove_existing_db_row) {
          if (volumeRow.existing_db_row === null) {
            showAlert(
              "Got remove existing db row as True but no row to remove",
            );
            continue;
          } else if (volumeRow.existing_db_row.user_id === null) {
            showAlert(
              "Cannot remove system volume row. Please set it to 0 to override it",
            );
            continue;
          } else {
            await deleteExerciseMuscleVolume(volumeRow.existing_db_row.id);
            continue;
          }
          // some of the following checks are only here to satisfy typescript
          // we are guaranteed volumeRow.new_value !== null by above
        } else if (
          volumeRow.existing_db_row === null &&
          volumeRow.new_value !== null
        ) {
          await addExerciseMuscleVolume({
            muscle_id: muscleId as MuscleGroup,
            exercise_id: exercise.id,
            volume_factor: volumeRow.new_value,
            user_id: user.user_id,
          });
          // guaranteed volumeRow.existing_db_row !== null && volumeRow.new_value !== null by above
        } else if (
          volumeRow.existing_db_row !== null &&
          volumeRow.new_value !== null
        ) {
          if (volumeRow.existing_db_row.user_id === null) {
            await addExerciseMuscleVolume({
              muscle_id: muscleId as MuscleGroup,
              exercise_id: exercise.id,
              volume_factor: volumeRow.new_value,
              user_id: user.user_id,
            });
          } else {
            await updateExerciseMuscleVolume({
              id: volumeRow.existing_db_row.id,
              patch: { volume_factor: volumeRow.new_value },
            });
          }
        } else {
          throw new Error(
            "Ended up in unknown branch of handle save volumes. Should not be possible",
          );
        }
      }

      showAlert("Saved muscle volumes.");
      void loadVolumesForExercise();
    } catch (e: any) {
      setVolumeError(e?.message ?? "Failed to save volumes");
    } finally {
      setLoadingVolumes(false);
    }
  };

  return (
    <View
      style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ ...typography.subsection, marginBottom: 8 }}>
        Muscle Volumes for {exercise.name}
      </Text>
      {!allowEditing && (
        <Text style={{ ...typography.hint, marginBottom: 8 }}>
          Editing is turned off
        </Text>
      )}

      {loadingVolumes ? (
        <View style={{ marginTop: 8 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {volumeError ? (
            <Text style={{ color: "crimson", marginTop: 6 }}>
              {volumeError}
            </Text>
          ) : null}

          <View style={{ marginTop: 8 }}>
            {volumeByMuscle &&
              muscleGroupsToRender.map((name) => {
                const entry = volumeByMuscle[name];
                const muscleGroup: MuscleGroupRow | undefined =
                  muscleGroups.get(name);
                return (
                  <View
                    key={name}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                      }}
                    >
                      {muscleGroup?.display_name ?? name}
                    </Text>

                    <ModalPicker
                      title={`Choose exercise volume for ${muscleGroup?.display_name ?? name}`}
                      help={
                        "Controls how much this exercise contributes to a muscle's training volume.\nFor example, a lat pulldown could count as 1 set for lats but only 0.5 sets for biceps."
                      }
                      options={(() => {
                        const allOptions: {
                          label: string;
                          value: "Delete" | "Default" | "Remove from View" | number;
                          description?: string;
                        }[] = [
                          ...[
                            0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
                            1.0,
                          ].map((n) => {
                            return { label: n.toFixed(1), value: n };
                          }),
                        ];
                        if (
                          entry.existing_db_row !== null &&
                          entry.existing_db_row.user_id !== null
                        ) {
                          allOptions.push({
                            label: "Delete User Overwrite",
                            value: "Delete",
                            description:
                              "Remove overwrites from database. Will revert back to system defined volume in database if present.",
                          });
                        }
                        allOptions.push({
                          label:
                            entry.existing_db_row?.volume_factor.toFixed(1) ??
                            "None",
                          value: "Default",
                          description:
                            entry.existing_db_row !== null
                              ? `Default database value ${entry.existing_db_row.user_id !== null ? "(user defined)" : "(system defined)"}`
                              : "Default value is None - No saved volume value in database yet",
                        });
                        if (entry.existing_db_row === null) {
                          allOptions.push({
                            label: "Remove from View",
                            value: "Remove from View",
                            description: "Removes from list of muscle groups and resets to default"
                          })
                        }
                        return allOptions;
                      })()}
                      value={
                        entry.remove_existing_db_row
                          ? "Delete"
                          : entry.new_value !== null
                            ? entry.new_value
                            : entry.existing_db_row !== null
                              ? "Default"
                              : null
                      }
                      onChange={(value) => {
                        if (value === "Delete") {
                          updateVolumeField(name, entry.new_value, true);
                        } else if (value === "Default") {
                          updateVolumeField(name, null, false);
                        } else if (value === "Remove from View") {
                          setMuscleGroupsToRender((prev) => prev.filter(mg => mg !== name));
                          updateVolumeField(name, null, false);
                        } else if (typeof value === "number") {
                          if (
                            entry.existing_db_row !== null &&
                            entry.existing_db_row.user_id !== null &&
                            value === entry.existing_db_row.volume_factor
                          ) {
                            updateVolumeField(name, null, false);
                          } else {
                            updateVolumeField(name, value, false);
                          }
                        } else {
                          showAlert(
                            `Unknown change requested: ${value}. Changing nothing`,
                          );
                        }
                      }}
                      pressableProps={{
                        style: {
                          alignSelf: "flex-end",
                          backgroundColor:
                            initialVolumeValuesRef.current !== null &&
                            !volumeEntryEqual(
                              entry,
                              initialVolumeValuesRef.current[name],
                            )
                              ? colors.fadedPrimaryOffset
                              : undefined,
                          borderRadius: 999,
                        },
                      }}
                      disabled={loadingVolumes || !allowEditing}
                    />
                  </View>
                );
              })}
          </View>

          {allowEditing && <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
            {MUSCLE_GROUPS.length != muscleGroupsToRender.length && (
              <ModalPicker
                title="Add Muscle Group Volume"
                options={MUSCLE_GROUPS.filter(
                  (mg) => !muscleGroupsToRender.includes(mg),
                ).map((mg) => {
                  return {
                    label: muscleGroups.get(mg)?.display_name ?? mg,
                    value: mg,
                  };
                }).toSorted((a, b) => a.value.localeCompare(b.value))}
                value={null}
                placeholder="Add Muscle Group"
                onChange={(value) =>
                  setMuscleGroupsToRender([...muscleGroupsToRender, value])
                }
                pressableProps={{
                  style: {
                    alignSelf: "flex-start",
                  },
                }}
                textProps={{ style: {...typography.body, fontWeight: '700'}}}
              />
            )}
            <Button
              title={"Import from Existing"}
              onPress={() => setShowCopyFromOther((prev) => !prev)}
              variant="secondary"
              style={{ padding: spacing.sm, margin: 0, backgroundColor: showCopyFromOther ? colors.fadedPrimary : undefined }}
              textProps={{ style: {...typography.body, fontWeight: '700'}}}
            />
            <Button
              title={"Revert All"}
              onPress={() => {
                setVolumeByMuscle(initialVolumeValuesRef.current);
                if (initialVolumeValuesRef.current !== null) {
                  const originalGroups = MUSCLE_GROUPS.filter(
                    (mg) => initialVolumeValuesRef.current![mg].existing_db_row !== null
                  );
                  setMuscleGroupsToRender(originalGroups);
                } else {
                  setMuscleGroupsToRender([]);
                }
                setVolumeError(null);
              }}
              variant="secondary"
              style={{ padding: spacing.sm, margin: 0 }}
              textProps={{ style: {...typography.body, fontWeight: '700'}}}
              disabled={volumeByMuscleEqual(
                initialVolumeValuesRef.current,
                volumeByMuscle,
              )}
            />
          </View>}

          {allowEditing && showCopyFromOther && <View>
            <TextField
              value={copyFromOtherSearch}
              onChangeText={(value) => {
                setCopyFromOtherSearch(value);
                (async () => setCopyFromOtherOptions(await searchExercises(value)))();
              }}
              placeholder="Search Exercises..."
            />
            {copyFromOtherOptions.map(exRow => {
              return <Button
                title={`Copy from ${exRow.name}`}
                onPress={() => {
                  setVolumeError(null);
                  setLoadingVolumes(true);

                  (async () => {
                    const user = await requireGetUser();
                    if (!user) return;

                    const source = await fetchExerciseMuscleVolumes(exRow.id, user.user_id);

                    setVolumeByMuscle(prev => {
                      if (!prev) return prev;

                      const next: VolumeByMuscle = { ...prev };
                      source.forEach((row, mg) => {
                        next[mg] = {
                          ...next[mg],
                          new_value: row.volume_factor,
                          remove_existing_db_row: false,
                        };
                      });
                      return next;
                    });

                    setMuscleGroupsToRender(prev => {
                      const set = new Set(prev);
                      source.forEach((_row, mg) => set.add(mg));
                      return Array.from(set);
                    });

                    setShowCopyFromOther(false);
                    setCopyFromOtherSearch("");
                    setCopyFromOtherOptions([]);
                  })()
                    .catch((e) =>
                      setVolumeError(`Error copying volumes: ${anyErrorToString(e, "Unknown Error")}`),
                    )
                    .finally(() => setLoadingVolumes(false));
                }}

                style={{ padding: spacing.sm, margin: 1, alignSelf: 'flex-start' }}
              />
            })}
          </View>}

          {allowEditing && (
            <Button
              title="Save volumes"
              onPress={handleSaveVolumes}
              disabled={
                loadingVolumes ||
                !allowEditing ||
                volumeByMuscleEqual(
                  initialVolumeValuesRef.current,
                  volumeByMuscle,
                )
              }
            />
          )}
          <Button
            title="Exit volumes"
            onPress={onRequestClose}
            variant="revert"
          />
        </>
      )}
    </View>
  );
};