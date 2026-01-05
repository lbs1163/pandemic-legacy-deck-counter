interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  decrementLabel: string;
  incrementLabel: string;
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  disabled,
  ariaLabel,
  decrementLabel,
  incrementLabel
}: StepperProps) {
  const handleDecrement = () => onChange(Math.max(min, value - 1));
  const handleIncrement = () => onChange(Math.min(max, value + 1));

  return (
    <div className="drawStepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="stepperButton"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label={decrementLabel}
      >
        &#9664;
      </button>
      <span className="stepperValue" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="stepperButton"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label={incrementLabel}
      >
        &#9654;
      </button>
    </div>
  );
}
