import { useEffect, useState } from "react";
import { TextInputProps } from "react-native";
import { TextField } from "./TextField";

type NumberFieldProps = Omit<
  TextInputProps,
  "onChangeText" | "value" | "keyboardType"
> & {
  numberValue: number | null; // external numeric value
  onChangeNumber: (value: number | null) => void;
  numberType: "float" | "int";
  precision?: number;
  emptyAsNull?: boolean;
};

export function NumberField({
  numberValue,
  onChangeNumber,
  numberType,
  precision = 1,
  emptyAsNull = true,
  ...rest
}: NumberFieldProps) {
  const [textValue, setTextValue] = useState<string>("");

  // Sync internal text with external numeric value when it changes
  useEffect(() => {
    if (numberValue == null) {
      setTextValue("");
      return;
    }

    // Try to see if current text already matches the numeric value
    const parsedCurrent =
      numberType === "int"
        ? Number.parseInt(textValue, 10)
        : Number.parseFloat(textValue);

    if (!Number.isNaN(parsedCurrent) && parsedCurrent === numberValue) {
      // Same numeric value → don't overwrite text formatting (e.g. "0.0")
      return;
    }

    // Otherwise, format from numberValue
    const formatted =
      numberType === "int"
        ? String(numberValue)
        : numberValue.toFixed(precision);

    setTextValue(formatted);
  }, [numberValue, numberType, precision]);

  return (
    <TextField
      {...rest}
      value={textValue}
      keyboardType={numberType === "int" ? "numeric" : "decimal-pad"}
      onChangeText={(text) => {
        if (text === "") {
          setTextValue("");
          onChangeNumber(emptyAsNull ? null : 0);
          return;
        }

        let nextText = text;

        const numericPattern =
          numberType === "int"
            ? /^-?\d+$/ // integers
            : /^-?\d*\.?\d*$/; // floats like "1", "1.", ".5", "1.23"

        if (!numericPattern.test(nextText)) {
          // ignore keystroke (don't update textValue)
          return;
        }

        const parsed =
          numberType === "int"
            ? Number.parseInt(nextText, 10)
            : Number.parseFloat(nextText);

        if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
          // ignore invalid input
          return;
        }

        const decIdx = nextText.indexOf(".");

        if (decIdx >= 0) {
          if (numberType === "float") {
            // keep up to `precision` decimals
            nextText = nextText.substring(0, decIdx + 1 + precision);
          } else {
            // int type: strip decimals entirely
            nextText = nextText.substring(0, decIdx);
          }

          if (nextText === "") {
            setTextValue("");
            onChangeNumber(emptyAsNull ? null : 0);
            return;
          }
        }

        setTextValue(nextText);
        onChangeNumber(parsed);
      }}
      onBlur={() => setTextValue(numberValue?.toString() ?? "")}
    />
  );
}
