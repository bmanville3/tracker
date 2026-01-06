import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { colors, spacing, typography } from "../theme";
import { RPE, RPES, WEIGHT_UNITS, WeightUnit } from "../types";
import { changeWeightUnit, requireGetUser } from "../utils";
import { Button } from "./Button";
import { ClosableModal, ClosableModalProps } from "./ClosableModal";
import { ModalPicker } from "./ModalPicker";
import { NumberField } from "./NumberField";
import { Selection } from "./Selection";

export const RPE_TABLE_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MAX_ALLOWED_REPS = Math.max(...RPE_TABLE_REPS);
export type RpeTableReps = (typeof RPE_TABLE_REPS)[number];

export const RPE_TABLE: Record<RPE, Record<RpeTableReps, number>> = {
  10:  {1:1.000, 2:0.955, 3:0.922, 4:0.892, 5:0.863, 6:0.837, 7:0.811, 8:0.786, 9:0.762, 10:0.739, 11:0.707, 12:0.680},
  9.5: {1:0.978, 2:0.939, 3:0.907, 4:0.878, 5:0.850, 6:0.824, 7:0.799, 8:0.774, 9:0.751, 10:0.723, 11:0.694, 12:0.667},
  9:   {1:0.955, 2:0.922, 3:0.892, 4:0.863, 5:0.837, 6:0.811, 7:0.786, 8:0.762, 9:0.739, 10:0.707, 11:0.680, 12:0.653},
  8.5: {1:0.939, 2:0.907, 3:0.878, 4:0.850, 5:0.824, 6:0.799, 7:0.774, 8:0.751, 9:0.723, 10:0.694, 11:0.667, 12:0.640},
  8:   {1:0.922, 2:0.892, 3:0.863, 4:0.837, 5:0.811, 6:0.786, 7:0.762, 8:0.739, 9:0.707, 10:0.680, 11:0.653, 12:0.626},
  7.5: {1:0.907, 2:0.878, 3:0.850, 4:0.824, 5:0.799, 6:0.774, 7:0.751, 8:0.723, 9:0.694, 10:0.667, 11:0.640, 12:0.613},
  7:   {1:0.892, 2:0.863, 3:0.837, 4:0.811, 5:0.786, 6:0.762, 7:0.739, 8:0.707, 9:0.680, 10:0.653, 11:0.626, 12:0.599},
  6.5: {1:0.878, 2:0.850, 3:0.824, 4:0.799, 5:0.774, 6:0.751, 7:0.723, 8:0.694, 9:0.667, 10:0.640, 11:0.613, 12:0.586},
  6:   {1:0.863, 2:0.837, 3:0.811, 4:0.786, 5:0.762, 6:0.739, 7:0.707, 8:0.680, 9:0.653, 10:0.626, 11:0.599, 12:0.574},
};

function isWithinRange(reps: number): boolean {
  return reps >= 1 && reps <= MAX_ALLOWED_REPS;
}

export function rpeChartPercentageOfMax(reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  const table = RPE_TABLE[rpe ?? 10];

  if (Number.isInteger(reps)) {
    // is an integer and within range -> has corresponding index
    return table[reps as RpeTableReps];
  }

  // take the weighted average of the nearest percentages

  const lower = Math.floor(reps) as RpeTableReps;
  const upper = Math.ceil(reps) as RpeTableReps;

  const lowerVal = table[lower];
  const upperVal = table[upper];

  const frac = reps - lower;   // push to range (0, 1)

  // say we did 4.3 reps, then we frac = 4.3 - 4 = 0.3 -> lowerVal * (1 - frac) + upperVal * frac = lowerVal * 0.7 + upperVal * 0.3
  return lowerVal * (1 - frac) + upperVal * frac;
}

export function rpeChartE1RM(weight: number, reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  const percent = rpeChartPercentageOfMax(reps, rpe);
  return percent === null ? null : weight / percent;
}

export function epleyPercentageOfMax(reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  return 1 / (1 + (reps + (10 - (rpe ?? 10))) / 30);
}

export function epleyE1RM(weight: number, reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  const percent = epleyPercentageOfMax(reps, rpe);
  return percent === null ? null : weight / percent;
}

export function brzyckiPercentageOfMax(reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  return (37 - (reps + (10 - (rpe ?? 10)))) / 36;
}

export function brzyckiE1RM(weight: number, reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  const percent = brzyckiPercentageOfMax(reps, rpe);
  return percent === null ? null : weight / percent;
}

export function landerPercentageOfMax(reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  return (101.3 - 2.67123 * (reps + (10 - (rpe ?? 10)))) / 100
}

export function landerE1RM(weight: number, reps: number, rpe?: RPE): number | null {
  if (!isWithinRange(reps)) {
    return null;
  }
  const percent = landerPercentageOfMax(reps, rpe);
  return percent === null ? null : weight / percent;
}


type TableProps = {
  getPercent: (reps: number, rpe?: RPE) => number | null;
};

function Table({ getPercent }: TableProps) {
  const reps: RpeTableReps[] = [...RPE_TABLE_REPS].sort((a, b) => a - b);
  const rpes: RPE[] = [...RPES].sort((a, b) => b - a);

  const cellStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 65,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  };

  return (
    <View style={{ flexDirection: "row" }}>
      {/* LEFT: STICKY RPE COLUMN */}
      <View>
        {/* Header cell for RPE */}
        <View style={cellStyle}>
          <Text style={{ ...typography.hint, fontWeight: "700" }}>RPE</Text>
        </View>

        {/* RPE values */}
        {rpes.map((rpe) => (
          <View key={rpe} style={cellStyle}>
            <Text style={typography.hint}>{rpe}</Text>
          </View>
        ))}
      </View>

      {/* RIGHT: HORIZONTALLY SCROLLABLE DATA */}
      <ScrollView horizontal>
        <View>
          {/* HEADER ROW: reps */}
          <View style={{ flexDirection: "row" }}>
            {reps.map((r) => (
              <View key={r} style={cellStyle}>
                <Text style={typography.hint}>{r}</Text>
              </View>
            ))}
          </View>

          {/* BODY ROWS: percentages */}
          {rpes.map((rpe) => (
            <View key={rpe} style={{ flexDirection: "row" }}>
              {reps.map((rep) => {
                const percentage = getPercent(rep, rpe);
                return (
                  <View key={rep} style={cellStyle}>
                    <Text style={typography.hint}>
                      {percentage !== null
                        ? `${(percentage * 100).toFixed(1)}%`
                        : "n/a%"}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}


export const RPE_TABLE_MODES = ["Tuchscherer's Chart", "Epley Formula (1985)", "Brzycki Formula (1993)", "Lander Formula (1985)"] as const;
export type RpeTableMode = (typeof RPE_TABLE_MODES)[number];
export const RPE_TABLE_MODE_DESCRIPTIONS: Record<RpeTableMode, string> = {
  "Tuchscherer's Chart":
    "A modern RPE-based %1RM chart built from Mike Tuchscherer's RTS dataset. Instead of assuming a fixed mathematical curve, it is derived from real lifter performance and Reps-In-Reserve logic. It tends to scale realistically across RPE values and rep ranges because it is “experience driven” rather than purely theoretical. Best choice for RPE-style training, auto-regulation, and lifters who actively use RIR/RPE concepts in training.",

  "Epley Formula (1985)":
    "A common 1RM equation. Mathematically: 1RM = weight \u00D7 (1 + reps/30), which implies about a ~3-3.3% drop in %1RM per rep. This produces roughly ~97% for a 1-rep max effort (not 100%), meaning it tends to slightly overestimate true 1RM at very low reps (1-3), but it generally matches well across moderate rep ranges (3-10). Best used when working with typical strength or hypertrophy rep ranges and when you want a simple, smooth, predictable curve.",

  "Brzycki Formula (1993)":
    "Another well-known rep-max model. Mathematically: 1RM = weight \u00D7 36 / (37 - reps), which stays closer to 100% near singles and declines more aggressively with additional reps. In practice this often tracks well at low-rep heavy strength work (1-5 reps), but becomes more conservative and less reliable as reps get high (8+). Good choice if the goal is strength-biased estimation and you care more about accurately modeling heavy top sets than high-rep work.",

  "Lander Formula (1985)":
    "A historically used but less popular linear model. Mathematically very similar in spirit to Epley: 1RM ≈ weight \u00D7 100 / (101.3 - 2.67123 \u00D7 reps). Useful primarily for comparison or academic curiosity, but rarely preferred as a main training tool today compared to Tuchscherer or Epley.",
};

export const RPE_TABLE_MODE_TO_PERCENT_FUNCTION: Record<RpeTableMode, (reps: number, rpe?: RPE) => number | null> = {
  "Tuchscherer's Chart": rpeChartPercentageOfMax,
  "Epley Formula (1985)": epleyPercentageOfMax,
  "Brzycki Formula (1993)": brzyckiPercentageOfMax,
  "Lander Formula (1985)": landerPercentageOfMax
}
export const RPE_TABLE_MODE_TO_E1RM_FUNCTION: Record<
  RpeTableMode,
  (weight: number, reps: number, rpe?: RPE) => number | null
> = {
  "Tuchscherer's Chart": rpeChartE1RM,
  "Epley Formula (1985)": epleyE1RM,
  "Brzycki Formula (1993)": brzyckiE1RM,
  "Lander Formula (1985)": landerE1RM,
};


export const TABS = ["Calculator", "Table", "Info", "Compare"] as const;
export type RpeTableTab = (typeof TABS)[number];

export type RpeTableProps = {
  mode: RpeTableMode;
  onModeChange: (m: RpeTableMode) => void;

  calcWeight: number | null;
  onCalcWeightChange: (v: number | null) => void;
  calcReps: number | null;
  onCalcRepsChange: (v: number | null) => void;
  calcRpe: RPE | null;
  onCalcRpeChange: (r: RPE | null) => void;
  calcUnit: WeightUnit;
  onCalcUnitChange: (u: WeightUnit) => void;
  tab: RpeTableTab;
  onChangeTab: (t: RpeTableTab) => void;
};

export function RpeTable({
  mode,
  onModeChange,
  calcWeight,
  onCalcWeightChange,
  calcReps,
  onCalcRepsChange,
  calcRpe,
  onCalcRpeChange,
  calcUnit,
  onCalcUnitChange,
  tab,
  onChangeTab,
}: RpeTableProps) {
  const percentFn = RPE_TABLE_MODE_TO_PERCENT_FUNCTION[mode];

  const percent =
    calcReps !== null && calcRpe !== null && percentFn
      ? percentFn(calcReps, calcRpe)
      : null;

  const e1rm =
    percent !== null && percent > 0 && calcWeight !== null
      ? calcWeight / percent
      : null;

  const dataset = Object.entries(RPE_TABLE_MODE_TO_PERCENT_FUNCTION).map(([k, f]) => {return {key: k, fn: f}});

  const ordered = [
    ...dataset.filter(d => d.key !== mode),
    ...dataset.filter(d => d.key === mode),
  ];

  const mapToPoints = (fn: (reps: number, rpe?: RPE) => number | null) =>
    RPE_TABLE_REPS.map((reps) => {
      const p = fn(reps, 10) ?? 0;
      return { value: p * 100 };
    });

  return (
    <View>
      {/* MODE PICKER – applies to all tabs */}
      <ModalPicker
        options={RPE_TABLE_MODES.map((m) => ({
          value: m,
          label: m,
          description: RPE_TABLE_MODE_DESCRIPTIONS[m],
        }))}
        value={mode}
        onChange={onModeChange}
        pressableProps={{
          style: { alignSelf: "flex-start", marginBottom: spacing.xs },
        }}
        textProps={{ style: typography.subsection }}
      />

      {/* TABS */}
      <View
        style={{
          flexDirection: "row",
          marginBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <Pressable
              key={t}
              onPress={() => onChangeTab(t)}
              style={{
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: active ? colors.primary : "transparent",
                marginRight: spacing.sm,
              }}
            >
              <Text
                style={{
                  ...typography.body,
                  fontWeight: active ? "700" : "400",
                }}
              >
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* TAB CONTENTS */}
      {tab === "Calculator" && (
        <View>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start', borderRadius: 999 }}>
            {WEIGHT_UNITS.map((u) => {
              const selected = u ===calcUnit;
              return (
                <Selection
                  key={u}
                  title={u}
                  isSelected={selected}
                  onPress={() => onCalcUnitChange(u)}
                  style={{ backgroundColor: colors.surface}}
                />
              );
            })}
          </View>
          <Text style={typography.label}>e1RM Calculator</Text>
          <Text style={typography.hint}>
            Enter the weight, reps, and RPE for a set to estimate your one-rep
            max using the selected chart.
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: spacing.sm,
              gap: spacing.md,
            }}
          >
            {/* Weight */}
            <View style={{ minWidth: 100 }}>
              <Text style={typography.hint}>Weight</Text>
              <NumberField
                numberValue={calcWeight}
                onChangeNumber={(value) => {
                  if (value !== null && value <= 0) {
                    onCalcWeightChange(null);
                  } else {
                    onCalcWeightChange(value);
                  }
                }}
                placeholder={`e.g. 225 ${calcUnit}s`}
                numberType="float"
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  ...typography.body,
                  width: 100,
                }}
              />
            </View>

            {/* Reps */}
            <View style={{ minWidth: 100 }}>
              <Text style={typography.hint}>Reps</Text>
              <NumberField
                numberValue={calcReps}
                onChangeNumber={(reps) => {
                  if (reps !== null && reps <= 0) {
                    onCalcRepsChange(null);
                  } else {
                    onCalcRepsChange(reps);
                  }
                }}
                placeholder="e.g. 5"
                numberType="float"
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  ...typography.body,
                  width: 100,
                }}
              />
            </View>

            {/* RPE */}
            <View style={{ minWidth: 100 }}>
              <Text style={typography.hint}>RPE</Text>
              <ModalPicker
                options={[
                  ...RPES.map((rpe) => ({
                    value: rpe,
                    label: String(rpe),
                  })),
                  { value: null, label: "Choose RPE" },
                ]}
                value={calcRpe}
                onChange={onCalcRpeChange}
                pressableProps={{
                  style: {
                    alignSelf: "flex-start",
                    paddingVertical: 8,
                    paddingHorizontal: 8,
                    minWidth: 100,
                  },
                }}
                textProps={{ style: typography.body }}
              />
            </View>
          </View>

          {calcReps !== null && !isWithinRange(calcReps) && <Text style={{...typography.hint, marginTop: 4}}>
            Reps must be between 1 and {MAX_ALLOWED_REPS} (inclusive)
          </Text>}

          <View style={{ marginTop: spacing.sm }}>
            <View>
              <Text style={[typography.label, { marginBottom: spacing.xs }]}>
                Estimated 1RM
              </Text>

              {/* Big, prominent e1RM pill */}
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: colors.fadedPrimary ?? colors.surfaceAlt,
                  marginBottom: spacing.xs,
                }}
              >
                <Text
                  style={{
                    ...typography.body,
                    fontWeight: "700",
                    fontSize: 20,
                  }}
                >
                  {e1rm?.toFixed(1) ?? 0.0} {calcUnit}s
                </Text>
              </View>
            </View>
            {e1rm !== null && percent !== null && calcWeight !== null && calcReps !== null && calcRpe !== null ? (
              <Text style={{...typography.hint, marginTop: 4}}>
                Calculated {calcWeight.toFixed(1)}{calcUnit}s as {(percent * 100).toFixed(1)}% of 1RM
                {"\n"}
                Used {calcWeight.toFixed(1)}{calcUnit}s &times; {calcReps.toFixed(1)} Reps @ RPE {calcRpe}
                {"\n"}
                Formula: {mode}
              </Text>) : <Text style={{...typography.hint, marginTop: 4}}>
                Enter a valid weight, reps, and RPE to see an estimated 1RM.
              </Text>}
          </View>
        </View>
      )}


      {tab === "Table" && (
        <View>
          <Table getPercent={RPE_TABLE_MODE_TO_PERCENT_FUNCTION[mode]} />
        </View>
      )}

      {tab === "Info" && (
        <View>
          <Text style={[typography.label, { marginTop: spacing.sm }]}>
            Description for {mode}
          </Text>
          <Text style={typography.body}>
            {RPE_TABLE_MODE_DESCRIPTIONS[mode]}
          </Text>

          <View style={{ borderWidth: 1, marginTop: 16, borderColor: colors.border }} />

          <Text style={typography.label}>RPE Charts</Text>
          <Text style={typography.hint}>
            RPE percentage charts estimate what percentage of your one-rep max
            (1RM) the average lifter would typically use to perform a given
            number of reps at a specific RPE. You can use these values to
            calculate your estimated one-rep max (e1RM) by dividing the weight
            lifted by the corresponding percentage.
            {"\n\n"}
            For example, using Tuchscherer&apos;s chart, if you perform 225lbs
            for 5 reps at RPE 7, the chart gives a value of 0.786. Your
            estimated 1RM would be:
            {"\n"}
            225lbs ÷ 0.786 = 286.2 lbs.
          </Text>
        </View>
      )}

      {tab === "Compare" && (
        <View>
          <Text style={typography.label}>Comparison of Percentages</Text>
          <LineChart
            height={220}
            spacing={30}
            initialSpacing={20}
            maxValue={36}
            yAxisOffset={64}
            yAxisLabelSuffix="%"
            yAxisTextStyle={typography.hint}
            xAxisLabelTextStyle={typography.hint}
            xAxisLabelTexts={RPE_TABLE_REPS.map((r) => r.toString())}
            data={mapToPoints(ordered[0].fn)}
            data2={mapToPoints(ordered[1].fn)}
            data3={mapToPoints(ordered[2].fn)}
            data4={mapToPoints(ordered[3].fn)}
            color1={ordered[0].key === mode ? colors.primary : colors.border}
            dataPointsColor1={ordered[0].key === mode ? colors.primary : colors.border}
            color2={ordered[1].key === mode ? colors.primary : colors.border}
            dataPointsColor2={ordered[1].key === mode ? colors.primary : colors.border}
            color3={ordered[2].key === mode ? colors.primary : colors.border}
            dataPointsColor3={ordered[2].key === mode ? colors.primary : colors.border}
            color4={ordered[3].key === mode ? colors.primary : colors.border}
            dataPointsColor4={ordered[3].key === mode ? colors.primary : colors.border}
            hideDataPoints={false}
          />


          {/* Legend */}
          <Text style={typography.hint}>
            Each line shows % of 1RM vs reps at RPE 10. The currently selected
            formula ({mode}) is highlighted.
          </Text>
          <View style={{ borderWidth: 1, borderColor: colors.border, marginTop: spacing.md}}/>
          <Text style={typography.label}>Comparison of Maxes</Text>
          <Text style={typography.hint}>
            This chart compares the estimated 1RM from each formula using the same
            set (weight, reps, RPE) you entered in the calculator.
          </Text>

          {e1rm !== null && calcWeight !== null && calcReps !== null && calcRpe !== null && isWithinRange(calcReps) ? (
            <>
              {/* Build chart data from the current calculator inputs */}
              <BarChart
                height={220}
                barWidth={40}
                spacing={20}
                initialSpacing={20}
                data={RPE_TABLE_MODES.map((m) => {
                  const e1rmFn = RPE_TABLE_MODE_TO_E1RM_FUNCTION[m];
                  const value = e1rmFn(calcWeight, calcReps, calcRpe) ?? 0;

                  // Short label for x-axis
                  let label: string;
                  if (m === "Tuchscherer's Chart") label = "Tuchscherer";
                  else if (m.startsWith("Epley")) label = "Epley";
                  else if (m.startsWith("Brzycki")) label = "Brzycki";
                  else label = "Lander";

                  const isActive = m === mode;

                  return {
                    value,
                    label,
                    // Highlight the currently selected mode
                    frontColor: isActive ? colors.primary : colors.border,
                  };
                })}
                xAxisLabelTextStyle={typography.hint}
                yAxisTextStyle={typography.hint}
                hideYAxisText={false}
                hideRules={false}
              />

              {/* Small legend / explanation */}
              <View style={{ marginTop: spacing.sm }}>
                <Text style={typography.hint}>
                  Max: {e1rm.toFixed(1)}{calcUnit}s - Set used: {calcWeight.toFixed(1)}{calcUnit}s &times; {calcReps.toFixed(1)} Reps @ RPE {calcRpe}
                </Text>
                <Text style={typography.hint}>
                  Highlighted formula: {mode}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ ...typography.hint, marginTop: spacing.sm }}>
              Enter a valid weight, reps (1-{MAX_ALLOWED_REPS}), and RPE in the
              Calculator tab to see a Comparison chart.
            </Text>
          )}
        </View>
      )}

      <View style={{ borderWidth: 1, marginTop: 16, borderColor: colors.border }} />
    </View>
  );
}

export function RpeTableModal(props: Omit<ClosableModalProps, 'children'>) {
  const [mode, setMode] = useState<RpeTableMode>("Tuchscherer's Chart");
  const [calcWeight, setCalcWeight] = useState<number | null>(null);
  const [calcReps, setCalcReps] = useState<number | null>(null);
  const [calcRpe, setCalcRpe] = useState<RPE | null>(null);
  const [calcUnit, setCalcUnit] = useState<WeightUnit>('lb');
  const [tab, setTab] = useState<RpeTableTab>('Calculator');

  const setInitialUnit = async () => {
    const user = await requireGetUser();
    if (!user) return;
    setCalcUnit(user.default_weight_unit);
  }

  const resetAll = () => {
    setMode("Tuchscherer's Chart");
    setCalcWeight(null);
    setCalcReps(null);
    setCalcRpe(null);
    setTab("Calculator");
    void setInitialUnit();
  }

  useEffect(() => {
    resetAll()
  }, [])

  return <ClosableModal
      {...props}
    >
      <Button
        title={"\u00D7"}
        variant="secondary"
        style={{ alignSelf: 'flex-end', padding: 2, borderWidth: 0 }}
        textProps={{ style: {...typography.body } }}
        onPress={props.onRequestClose}
      />
      <RpeTable
        mode={mode}
        onModeChange={setMode}
        calcWeight={calcWeight}
        onCalcWeightChange={setCalcWeight}
        calcReps={calcReps}
        onCalcRepsChange={setCalcReps}
        calcRpe={calcRpe}
        onCalcRpeChange={setCalcRpe}
        calcUnit={calcUnit}
        onCalcUnitChange={(newUnit) => {
          if (calcWeight !== null) {
            setCalcWeight(changeWeightUnit(calcWeight, calcUnit, newUnit));
          }
          setCalcUnit(newUnit);
        }}
        tab={tab}
        onChangeTab={setTab}
      />
    </ClosableModal>
}
