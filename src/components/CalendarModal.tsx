// CalendarModal.tsx
import { colors, spacing, typography } from "@/src/theme";
import type { ISODate } from "@/src/types";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fromISODate, toISODate } from "../utils";
import { Button } from "./Button";
import { ClosableModal } from "./ClosableModal";
import { Selection } from "./Selection";

type CalendarModalProps = {
  visible: boolean;
  /** Called when the user taps outside or otherwise requests close */
  onRequestClose: () => void;

  /** Currently selected date (YYYY-MM-DD) from the caller */
  selectedDate: ISODate | null;
  /** Called when the user confirms the selection via Save */
  onSelectDate: (date: ISODate) => void;

  /** Optional: initial month to show if no selectedDate */
  initialMonth?: ISODate;
  title?: string;
  doNotCloseOnSelect?: boolean;
};

const TOTAL_CELLS = 42;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type PickerMode = "date" | "month" | "year";

export function CalendarModal(props: CalendarModalProps) {
  const {
    visible,
    onRequestClose,
    selectedDate,
    onSelectDate,
    initialMonth,
    title = "Select date",
    doNotCloseOnSelect = false,
  } = props;

  // Determine which month to show when we (re)open
  const initialMonthDate = useMemo(() => {
    if (selectedDate) return fromISODate(selectedDate);
    if (initialMonth) return fromISODate(initialMonth);
    return new Date();
  }, [selectedDate, initialMonth]);

  const [monthCursor, setMonthCursor] = useState<Date>(initialMonthDate);
  const [pickerMode, setPickerMode] = useState<PickerMode>("date");

  // Local pending selection; caller isn't notified until Save
  const [pendingDate, setPendingDate] = useState<ISODate | null>(selectedDate);

  // When modal becomes visible (or selectedDate changes), reset local state
  useEffect(() => {
    if (!visible) return;
    setPendingDate(selectedDate);
    setMonthCursor(initialMonthDate);
    setPickerMode("date");
  }, [visible, selectedDate, initialMonthDate]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  // What we visually consider "selected" is the pending selection, not the prop
  const selectedISO = pendingDate ?? null;
  const todayISO = useMemo(() => toISODate(new Date()), []);

  const calendarCells: (Date | null)[] = useMemo(() => {
    const cells: (Date | null)[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(year, month, day));
    }

    while (cells.length < TOTAL_CELLS) {
      cells.push(null);
    }

    return cells;
  }, [year, month, firstWeekday, daysInMonth]);

  const goPrevMonth = () => {
    setPickerMode("date");
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const goNextMonth = () => {
    setPickerMode("date");
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const monthLabel = MONTH_NAMES[month];
  const yearLabel = String(year);

  const yearOptions = useMemo(() => {
    const ys: number[] = [];
    const base = year;
    for (let y = base - 5; y <= base + 5; y++) {
      ys.push(y);
    }
    return ys;
  }, [year]);

  const handleSelectDate = (d: Date) => {
    const iso = toISODate(d);
    setPendingDate(iso);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const iso = toISODate(today);
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setPickerMode("date");
    setPendingDate(iso);
  };

  const handleSave = () => {
    if (!pendingDate) return;
    onSelectDate(pendingDate);
    if (!doNotCloseOnSelect) {
      onRequestClose();
    }
  };

  return (
    <ClosableModal
      visible={visible}
      onRequestClose={onRequestClose}
      animationType="fade"
      transparent
    >
      {/* Header with title + X */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Button
          title={"×"}
          variant="revert"
          onPress={onRequestClose}
          style={{ paddingVertical: 4, paddingHorizontal: 8 }}
        />
      </View>

      {/* Month / Year row */}
      <View style={styles.monthRow}>
        <Pressable style={styles.navButton} onPress={goPrevMonth}>
          <Text style={styles.navText}>{"‹"}</Text>
        </Pressable>

        <View style={styles.monthYearButtons}>
          <Selection
            title={monthLabel}
            isSelected={pickerMode === "month"}
            onPress={() =>
              setPickerMode((prev) => (prev === "month" ? "date" : "month"))
            }
            textProps={{ style: typography.body }}
          />

          <Selection
            title={yearLabel}
            isSelected={pickerMode === "year"}
            onPress={() =>
              setPickerMode((prev) => (prev === "year" ? "date" : "year"))
            }
            textProps={{ style: typography.body }}
          />
        </View>

        <Pressable style={styles.navButton} onPress={goNextMonth}>
          <Text style={styles.navText}>{"›"}</Text>
        </Pressable>
      </View>

      {/* Pickers / calendar body */}
      {pickerMode === "date" && (
        <View style={{ maxHeight: 250, maxWidth: 300, alignSelf: "center" }}>
          {/* Weekdays */}
          <View style={styles.weekdaysRow}>
            {["Su", "M", "T", "W", "Th", "F", "S"].map((d) => (
              <Text key={d} style={styles.weekdayText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {calendarCells.map((cell, idx) => {
              if (cell === null) {
                return <View key={idx} style={styles.dayCell} />;
              }

              const iso = toISODate(cell);
              const isSelected = iso === selectedISO;
              const isToday = iso === todayISO;

              return (
                <Pressable
                  key={iso}
                  style={[
                    styles.dayCell,
                    isToday && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                  onPress={() => handleSelectDate(cell)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.daySelectedText,
                    ]}
                  >
                    {cell.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {pickerMode === "month" && (
        <View style={styles.monthPickerGrid}>
          {MONTH_NAMES.map((name, idx) => (
            <Pressable
              key={name}
              style={[
                styles.monthPickerCell,
                name === MONTH_NAMES[month] && styles.monthPickerCellActive,
              ]}
              onPress={() => {
                setMonthCursor(new Date(year, idx, 1));
                setPickerMode("date");
              }}
            >
              <Text
                style={[
                  styles.monthPickerText,
                  name === MONTH_NAMES[month] && styles.monthPickerTextActive,
                ]}
              >
                {name.slice(0, 3)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {pickerMode === "year" && (
        <View style={styles.yearPickerGrid}>
          {yearOptions.map((y) => (
            <Pressable
              key={y}
              style={[
                styles.yearPickerCell,
                y === year && styles.yearPickerCellActive,
              ]}
              onPress={() => {
                setMonthCursor(new Date(y, month, 1));
                setPickerMode("date");
              }}
            >
              <Text
                style={[
                  styles.yearPickerText,
                  y === year && styles.yearPickerTextActive,
                ]}
              >
                {y}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Footer: Today + Save */}
      <View style={styles.footerRow}>
        <Pressable style={styles.todayButton} onPress={handleSelectToday}>
          <Text style={styles.todayButtonText}>Select Today</Text>
        </Pressable>

        <Button
          title="Save date"
          onPress={handleSave}
          disabled={!pendingDate}
          style={{
            marginLeft: spacing.sm,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
          }}
        />
      </View>
    </ClosableModal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    ...typography.section,
    flex: 1,
  },

  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  monthYearButtons: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },

  navButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  navText: {
    ...typography.subsection,
  },

  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  weekdayText: {
    ...typography.hint,
    width: 32,
    textAlign: "center",
    color: colors.textSecondary,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%", // 100 / 7
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
    borderRadius: 999,
  },
  dayText: {
    ...typography.body,
    fontSize: 14,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  daySelectedText: {
    color: colors.textOnPrimary,
    fontWeight: "600",
  },

  monthPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  monthPickerCell: {
    width: "25%",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  monthPickerCellActive: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
  },
  monthPickerText: {
    ...typography.body,
    fontSize: 14,
  },
  monthPickerTextActive: {
    fontWeight: "600",
  },

  yearPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  yearPickerCell: {
    width: "25%",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  yearPickerCellActive: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
  },
  yearPickerText: {
    ...typography.body,
    fontSize: 14,
  },
  yearPickerTextActive: {
    fontWeight: "600",
  },

  footerRow: {
    alignItems: "center",
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  todayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  todayButtonText: {
    ...typography.hint,
    color: colors.primary,
    fontWeight: "600",
  },
});
