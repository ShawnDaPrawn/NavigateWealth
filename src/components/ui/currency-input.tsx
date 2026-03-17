import * as React from "react";
import { Input } from "./input";
import { cn } from "./utils";

/**
 * CurrencyInputField - Currency input with thousand separators
 * Formats numbers with commas (e.g., "1,000,000.50")
 * Compatible with react-hook-form field spreading
 */
export const CurrencyInputField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ className, value, onChange, onBlur, onFocus, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState<string>("");
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync display value when external value changes and not focused
  React.useEffect(() => {
    if (!isFocused) {
      const formatted = formatWithSeparators(String(value || ""));
      setDisplayValue(formatted);
    }
  }, [value, isFocused]);

  const formatWithSeparators = (input: string): string => {
    // Remove all non-numeric characters except decimal point
    const cleaned = input.replace(/[^\d.]/g, '');
    
    // Return empty string for empty/zero values
    if (!cleaned || cleaned === "0" || cleaned === "0.") return "";
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : "";
    
    // Add thousand separators (commas for South African format)
    const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // Return with decimal part if it exists
    return decimalPart ? `${formatted}.${decimalPart}` : formatted;
  };

  const cleanValue = (input: string): string => {
    return input.replace(/[^\d.]/g, '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cleaned = cleanValue(inputValue);
    
    // Update display with unformatted value while typing
    setDisplayValue(isFocused ? cleaned : formatWithSeparators(cleaned));
    
    // Create a new event with cleaned value for react-hook-form
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: cleaned,
      },
    } as React.ChangeEvent<HTMLInputElement>;
    
    if (onChange) {
      onChange(syntheticEvent);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Show unformatted value when focused for easier editing
    const cleaned = cleanValue(displayValue);
    setDisplayValue(cleaned);
    
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Format with separators when losing focus
    const cleaned = cleanValue(displayValue);
    const formatted = formatWithSeparators(cleaned);
    setDisplayValue(formatted);
    
    // Create a new event with cleaned value for react-hook-form
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: cleaned,
      },
    } as React.FocusEvent<HTMLInputElement>;
    
    if (onBlur) {
      onBlur(syntheticEvent);
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
        R
      </span>
      <Input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn("pl-8", className)}
        {...props}
      />
    </div>
  );
});

CurrencyInputField.displayName = "CurrencyInputField";