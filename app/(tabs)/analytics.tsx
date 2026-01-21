import { fetchWorkoutLogsInRange, fetchWorkoutLogsOnOrAfterDate, FULL_WORKOUT_LOG_CACHE_NAME, WORKOUT_LOG_HEADER_CACHE_NAME } from "@/src/api/workoutLogApi";
import { FullAttachedWorkout } from "@/src/api/workoutSharedApi";
import {
  Button,
  ModalPicker,
  Screen
} from "@/src/components";
import { CalendarModal } from "@/src/components/CalendarModal";
import { ExerciseTracker } from "@/src/screens/analytics/ExerciseTracker";
import { Volumes } from "@/src/screens/analytics/Volumes";
import { CACHE_FACTORY } from "@/src/swrCache";
import { colors, spacing, typography } from "@/src/theme";
import { ISODate } from "@/src/types";
import { requireGetUser, showAlert, toISODate } from "@/src/utils";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

function getDaySpanIncludingToday(days: number): ISODate {
  if (days < 0) {
    return toISODate(new Date(0));
  }
  if (days === 0) {
    return toISODate(new Date());
  }
  const today = new Date();
  today.setDate(today.getDate() - (days - 1));
  return toISODate(today);
}

export default function Analytics() {
  ///////////
  // Volume Handles
  ///////////
  const [muscleVolumeDays, setMuscleVolumeDays] = useState<number>(7);
  const [workoutsForMuscleVolume, setWorkoutsForMuscleVolume] = useState<FullAttachedWorkout<'log'>[]>([]);
  const [isFetchingVolumes, setIsFetchingVolumes] = useState<boolean>(false);
  ///////////
  ///////////

  ///////////
  // Exercise Handles
  ///////////
  const [isFetchingWorkoutsForExercise, setIsFetchingWorkoutsForExercise] = useState<boolean>(false);
  const [workoutsForExercises, setWorkoutsForExercises] = useState<FullAttachedWorkout<'log'>[]>([]);
  const [openDatePicker, setOpenDatePicker] = useState<boolean>(false);
  const [datePickerSelectedDate, setDatePickerSelectedDate] = useState<ISODate | null>(null);
  const [calendarTitle, setCalendarTitle] = useState<string>('');
  const [datePickerFn, setDatePickerFn] = useState<((date: ISODate) => void) | null>(null);

  const [startDate, setStartDate] = useState<ISODate>(getDaySpanIncludingToday(30));
  const [endDate, setEndDate] = useState<ISODate>(getDaySpanIncludingToday(1));

  const initStart = useRef<ISODate | null>(null);
  const initEnd = useRef<ISODate | null>(null);
  ///////////
  ///////////

  const fetchWorkoutsForExercises = useCallback(async () => {
    setIsFetchingWorkoutsForExercise(true);
    try {
      setWorkoutsForExercises(await fetchWorkoutLogsInRange(startDate, endDate));
      initStart.current = startDate;
      initEnd.current = endDate;
    } finally {
      setIsFetchingWorkoutsForExercise(false);
    }
  }, [startDate, endDate]);

  const fetchMuscleVolumes = useCallback(async () => {
    setIsFetchingVolumes(true);
    try {
      const workouts = await fetchWorkoutLogsOnOrAfterDate(getDaySpanIncludingToday(muscleVolumeDays));
      setWorkoutsForMuscleVolume(workouts);
    } finally {
      setIsFetchingVolumes(false);
    }
  }, [muscleVolumeDays]);

  useEffect(() => { fetchMuscleVolumes(); }, [fetchMuscleVolumes]);
  useEffect(() => { fetchWorkoutsForExercises(); }, [fetchWorkoutsForExercises]);

  useEffect(() => {
    return CACHE_FACTORY.subscribe((e) => {
      if (e.cacheName === FULL_WORKOUT_LOG_CACHE_NAME) {
        fetchMuscleVolumes();
        fetchWorkoutsForExercises();
      }
    });
  }, [fetchMuscleVolumes, fetchWorkoutsForExercises]);

  return (
    <Screen center={false}>
      {/** Volume Handles */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        <Text style={typography.subsection}>Muscle Set Volume</Text>
        <ModalPicker
          title="Pick Date Span"
          help="Pick the date span to track set volumes per muscle group."
          options={([1, 3, 7, 14, 30, 60, 90, 365] as const).map((v) => {
            return {
              value: v,
              label: v === 1 ? "Today" : `Last ${v} Days`,
              description:
                v === 1
                  ? `Get workouts from today: ${getDaySpanIncludingToday(1)}.`
                  : `Gets workout over the last ${v} days including today. Spans from ${getDaySpanIncludingToday(v)} to ${getDaySpanIncludingToday(1)}.`,
            };
          })}
          value={muscleVolumeDays}
          onChange={(value) => {
            if (value === muscleVolumeDays) {
              return;
            }
            setMuscleVolumeDays(value);
          }}
          pressableProps={{
            style: {
              paddingHorizontal: spacing.padding_sm,
              paddingVertical: spacing.padding_sm,
            },
          }}
          disabled={isFetchingVolumes}
        />
      </View>
      <Volumes
        workoutsForMuscleVolume={workoutsForMuscleVolume}
        daysSpan={muscleVolumeDays}
      />
      {/** ////////////////// */}

      <View style={{borderWidth: 1, borderColor: colors.border, margin: spacing.lg}}/>

      {/** Track exercises specifically */}
      <Text style={typography.subsection}>Exercise Tracker</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Text style={typography.body}>From</Text>
        <Pressable
          onPress={() => {
            setCalendarTitle(`Pick start date. Must be before or on ${endDate}`)
            setDatePickerFn(() => (date: ISODate) => {
              if (date > endDate) {
                showAlert(`Start date must be before or on ${endDate}`);
                return;
              }
              setStartDate(date);
              setDatePickerSelectedDate(date);
            })
            setDatePickerSelectedDate(startDate);
            setOpenDatePicker(true);
          }}
          style={styles.pressable}
        >
          <Text style={typography.hint}>{startDate}</Text>
        </Pressable>
        <Text style={typography.body}>To</Text>
        <Pressable
          onPress={() => {
            setCalendarTitle(`Pick end date. Must be on or after ${startDate}`)
            setDatePickerFn(() => (date: ISODate) => {
              if (date < startDate) {
                showAlert(`End date must be on or after ${startDate}`);
                return;
              }
              setEndDate(date);
              setDatePickerSelectedDate(date);
            })
            setDatePickerSelectedDate(endDate);
            setOpenDatePicker(true);
          }}
          style={styles.pressable}
        >
          <Text style={typography.hint}>{endDate}</Text>
        </Pressable>
        <Button
          title={"Recompute"}
          style={{ alignSelf: 'flex-start', padding: spacing.padding_sm }}
          textProps={{ style: {fontSize: typography.body.fontSize} }}
          onPress={fetchWorkoutsForExercises}
          disabled={initStart.current === startDate && initEnd.current === endDate || isFetchingWorkoutsForExercise}
        />
      </View>
      {isFetchingWorkoutsForExercise ? <ActivityIndicator/> : <ExerciseTracker
        trackOverWorkouts={workoutsForExercises}
      />}
      <CalendarModal
        title={calendarTitle}
        visible={openDatePicker}
        onRequestClose={() => setOpenDatePicker(false)}
        selectedDate={datePickerSelectedDate}
        onSelectDate={(date) => {
          if (datePickerFn) {
            datePickerFn(date);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 10,
    paddingVertical: spacing.padding_md,
    paddingHorizontal: spacing.padding_md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
