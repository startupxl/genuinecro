import { CONVERSION_GOAL_OPTIONS, type ConversionGoal, type ConversionGoalType } from "@/lib/conversionGoals";

interface ConversionGoalSelectProps {
  value: ConversionGoal | null;
  onChange: (goal: ConversionGoal) => void;
  disabled?: boolean;
}

const macroOptions = CONVERSION_GOAL_OPTIONS.filter((o) => o.isMacro);
const microOptions = CONVERSION_GOAL_OPTIONS.filter((o) => !o.isMacro && o.type !== "custom");
const customOption = CONVERSION_GOAL_OPTIONS.find((o) => o.type === "custom")!;

const ConversionGoalSelect = ({ value, onChange, disabled }: ConversionGoalSelectProps) => {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as ConversionGoalType;
    const option = CONVERSION_GOAL_OPTIONS.find((o) => o.type === type);
    if (!option) return;
    onChange(
      type === "custom"
        ? { type, isMacro: option.isMacro, customLabel: "" }
        : { type, isMacro: option.isMacro }
    );
  };

  const handleCustomLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ type: "custom", isMacro: false, customLabel: e.target.value });
  };

  return (
    <div className="space-y-2">
      <select
        value={value?.type ?? ""}
        onChange={handleSelectChange}
        disabled={disabled}
        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
      >
        <option value="" disabled>Select a conversion goal…</option>
        <optgroup label="Macro">
          {macroOptions.map((o) => (
            <option key={o.type} value={o.type}>{o.label}</option>
          ))}
        </optgroup>
        <optgroup label="Micro">
          {microOptions.map((o) => (
            <option key={o.type} value={o.type}>{o.label}</option>
          ))}
        </optgroup>
        <option value={customOption.type}>{customOption.label}</option>
      </select>

      {value?.type === "custom" && (
        <input
          type="text"
          value={value.customLabel ?? ""}
          onChange={handleCustomLabelChange}
          disabled={disabled}
          placeholder="Describe the goal…"
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
        />
      )}
    </div>
  );
};

export default ConversionGoalSelect;
