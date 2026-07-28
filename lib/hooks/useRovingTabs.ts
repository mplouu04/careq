"use client";

import { useCallback, type KeyboardEvent } from "react";

type UseRovingTabsOptions<T extends string> = {
  values: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Values that cannot be selected via keyboard or activation */
  disabled?: Partial<Record<T, boolean>>;
  orientation?: "horizontal" | "vertical";
};

function focusTab(tabValue: string) {
  const el = document.getElementById(`tab-${tabValue}`);
  el?.focus();
}

/**
 * WAI-ARIA Tabs keyboard pattern: Left/Right (or Up/Down), Home, End.
 * Only the selected tab is in the tab order; arrow keys move selection and focus.
 */
export function useRovingTabs<T extends string>({
  values,
  value,
  onChange,
  disabled,
  orientation = "horizontal",
}: UseRovingTabsOptions<T>) {
  const enabledValues = values.filter((v) => !disabled?.[v]);

  const selectRelative = useCallback(
    (from: T, delta: number) => {
      if (enabledValues.length === 0) return;
      const currentIndex = enabledValues.indexOf(from);
      const start = currentIndex >= 0 ? currentIndex : 0;
      const next =
        enabledValues[(start + delta + enabledValues.length) % enabledValues.length];
      onChange(next);
      // Focus after React commits selection; microtask is enough for same-tick updates
      queueMicrotask(() => focusTab(next));
    },
    [enabledValues, onChange]
  );

  const onTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, tabValue: T) => {
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

      switch (event.key) {
        case prevKey:
          event.preventDefault();
          selectRelative(tabValue, -1);
          break;
        case nextKey:
          event.preventDefault();
          selectRelative(tabValue, 1);
          break;
        case "Home":
          event.preventDefault();
          if (enabledValues[0]) {
            onChange(enabledValues[0]);
            queueMicrotask(() => focusTab(enabledValues[0]));
          }
          break;
        case "End":
          event.preventDefault();
          if (enabledValues[enabledValues.length - 1]) {
            const last = enabledValues[enabledValues.length - 1];
            onChange(last);
            queueMicrotask(() => focusTab(last));
          }
          break;
        default:
          break;
      }
    },
    [enabledValues, onChange, orientation, selectRelative]
  );

  const getTabProps = useCallback(
    (tabValue: T) => {
      const isSelected = value === tabValue;
      const isDisabled = Boolean(disabled?.[tabValue]);
      return {
        role: "tab" as const,
        id: `tab-${tabValue}`,
        "aria-selected": isSelected,
        "aria-disabled": isDisabled || undefined,
        tabIndex: isSelected ? 0 : -1,
        disabled: isDisabled,
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          if (isDisabled) return;
          onTabKeyDown(event, tabValue);
        },
      };
    },
    [disabled, onTabKeyDown, value]
  );

  const getPanelProps = useCallback(
    (panelValue: T) => ({
      role: "tabpanel" as const,
      id: `panel-${panelValue}`,
      "aria-labelledby": `tab-${panelValue}`,
      hidden: value !== panelValue,
      tabIndex: 0 as const,
    }),
    [value]
  );

  return { getTabProps, getPanelProps };
}
