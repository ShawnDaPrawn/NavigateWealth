import * as React from "react";

import { cn } from "./utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, placeholder, autoComplete, autoCorrect, autoCapitalize, spellCheck, readOnly, inputMode, name, id, ...props }, ref) => {
    const isSearchLikeInput =
      type === "search" ||
      inputMode === "search" ||
      (typeof placeholder === "string" && /^\s*search\b/i.test(placeholder));
    const [autofillGuardActive, setAutofillGuardActive] = React.useState(isSearchLikeInput);

    return (
      <input
        type={type}
        placeholder={placeholder}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-white border-border flex h-10 w-full min-w-0 rounded-lg border px-3 py-2 text-base transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-primary/50",
          "focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px] shadow-sm",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        ref={ref}
        name={name ?? (isSearchLikeInput ? placeholder?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined)}
        id={id}
        inputMode={inputMode ?? (isSearchLikeInput ? "search" : undefined)}
        readOnly={readOnly ?? (isSearchLikeInput ? autofillGuardActive : undefined)}
        autoComplete={autoComplete ?? (isSearchLikeInput ? "off" : undefined)}
        autoCorrect={autoCorrect ?? (isSearchLikeInput ? "off" : undefined)}
        autoCapitalize={autoCapitalize ?? (isSearchLikeInput ? "off" : undefined)}
        spellCheck={spellCheck ?? (isSearchLikeInput ? false : undefined)}
        data-1p-ignore={isSearchLikeInput ? "true" : undefined}
        data-lpignore={isSearchLikeInput ? "true" : undefined}
        data-form-type={isSearchLikeInput ? "other" : undefined}
        onFocus={(event) => {
          if (isSearchLikeInput) {
            setAutofillGuardActive(false);
          }
          onFocus?.(event);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
