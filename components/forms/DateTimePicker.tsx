"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  getYear,
  getMonth,
  setMonth,
  setYear,
} from "date-fns";
import { cn } from "@/lib/utils";

type Accent = "slate" | "violet" | "sky" | "emerald" | "amber";

type AccentStyle = {
  selected: string;
  today: string;
  hover: string;
  icon: string;
  ring: string;
  chip: string;
  soft: string;
};

/** Default monochrome chrome — matches workspace PageHeader / AdminPageHero. */
const SLATE_STYLES: AccentStyle = {
  selected: "bg-slate-900 text-white shadow-sm",
  today: "ring-2 ring-slate-300",
  hover: "hover:bg-slate-50",
  icon: "text-slate-500",
  ring: "ring-2 ring-slate-200 border-slate-300",
  chip: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  soft: "text-slate-600 hover:text-slate-800",
};

const ACCENT_STYLES: Record<Accent, AccentStyle> = {
  slate: SLATE_STYLES,
  // Legacy accents kept for callers; resolveAccent maps unknown → slate.
  violet: {
    selected: "bg-slate-900 text-white shadow-sm",
    today: "ring-2 ring-slate-300",
    hover: "hover:bg-slate-50",
    icon: "text-slate-500",
    ring: "ring-2 ring-slate-200 border-slate-300",
    chip: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    soft: "text-slate-600 hover:text-slate-800",
  },
  sky: {
    selected: "bg-slate-900 text-white shadow-sm",
    today: "ring-2 ring-slate-300",
    hover: "hover:bg-slate-50",
    icon: "text-slate-500",
    ring: "ring-2 ring-slate-200 border-slate-300",
    chip: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    soft: "text-slate-600 hover:text-slate-800",
  },
  emerald: {
    selected: "bg-slate-900 text-white shadow-sm",
    today: "ring-2 ring-slate-300",
    hover: "hover:bg-slate-50",
    icon: "text-slate-500",
    ring: "ring-2 ring-slate-200 border-slate-300",
    chip: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    soft: "text-slate-600 hover:text-slate-800",
  },
  amber: {
    selected: "bg-slate-900 text-white shadow-sm",
    today: "ring-2 ring-slate-300",
    hover: "hover:bg-slate-50",
    icon: "text-slate-500",
    ring: "ring-2 ring-slate-200 border-slate-300",
    chip: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    soft: "text-slate-600 hover:text-slate-800",
  },
};

function resolveAccentStyles(accent?: string | null): AccentStyle {
  if (accent && Object.prototype.hasOwnProperty.call(ACCENT_STYLES, accent)) {
    return ACCENT_STYLES[accent as Accent] ?? SLATE_STYLES;
  }
  return SLATE_STYLES;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
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

/** School-day friendly half-hour slots (06:00–20:00). */
const TIME_PRESETS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const label = `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
  return { label, value };
});

function getCalendarDays(currentMonth: Date): Date[] {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

function parseDateSafe(value: string): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function formatTimeLabel(timeValue: string): string {
  if (!timeValue) return "";
  try {
    return format(parseISO(`2000-01-01T${timeValue}`), "h:mm a");
  } catch {
    return timeValue;
  }
}

function yearOptions(centerYear: number, minDate?: Date | null, maxDate?: Date | null) {
  const minY = minDate ? getYear(minDate) : centerYear - 40;
  const maxY = maxDate ? getYear(maxDate) : centerYear + 10;
  const start = Math.min(minY, centerYear - 5);
  const end = Math.max(maxY, centerYear + 5);
  const years: number[] = [];
  for (let y = start; y <= end; y += 1) years.push(y);
  return years;
}

function TriggerClear({ onClear }: { onClear: () => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Clear"
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          onClear();
        }
      }}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      <X className="h-3.5 w-3.5" />
    </span>
  );
}

// ── Date calendar panel ───────────────────────────────────────────────────────

function DateCalendarPanel({
  value,
  onChange,
  onClose,
  accent,
  minDate,
  maxDate,
  styles: stylesProp,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  accent?: string;
  minDate?: string;
  maxDate?: string;
  styles?: AccentStyle;
}) {
  const styles = stylesProp ?? resolveAccentStyles(accent);
  const selectedDate = parseDateSafe(value);
  const [viewMonth, setViewMonth] = useState(
    () => selectedDate || new Date(),
  );
  const calendarDays = useMemo(() => getCalendarDays(viewMonth), [viewMonth]);
  const minDateObj = minDate ? parseDateSafe(minDate) : null;
  const maxDateObj = maxDate ? parseDateSafe(maxDate) : null;
  const years = useMemo(
    () => yearOptions(getYear(viewMonth), minDateObj, maxDateObj),
    [viewMonth, minDateObj, maxDateObj],
  );

  const isDateDisabled = useCallback(
    (date: Date) => {
      if (minDateObj) {
        const min = new Date(minDateObj);
        min.setHours(0, 0, 0, 0);
        if (date < min) return true;
      }
      if (maxDateObj) {
        const max = new Date(maxDateObj);
        max.setHours(23, 59, 59, 999);
        if (date > max) return true;
      }
      return false;
    },
    [minDateObj, maxDateObj],
  );

  function handleSelectDate(date: Date) {
    if (isDateDisabled(date)) return;
    onChange(format(date, "yyyy-MM-dd"));
    onClose();
  }

  return (
    <div className="w-full min-w-[260px] max-w-[300px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/60">
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <select
          aria-label="Month"
          value={getMonth(viewMonth)}
          onChange={(e) =>
            setViewMonth(setMonth(viewMonth, Number(e.target.value)))
          }
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-200"
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>

        <select
          aria-label="Year"
          value={getYear(viewMonth)}
          onChange={(e) =>
            setViewMonth(setYear(viewMonth, Number(e.target.value)))
          }
          className="w-[5.25rem] shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-200"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            setViewMonth(today);
            handleSelectDate(today);
          }}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
            styles.chip,
          )}
        >
          Today
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onClose();
            }}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {day}
          </div>
        ))}
        {calendarDays.map((day, idx) => {
          const disabled = isDateDisabled(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, viewMonth);
          const isTodayDate = isToday(day);

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => handleSelectDate(day)}
              className={cn(
                "grid h-9 w-full place-items-center rounded-lg text-sm transition",
                !isCurrentMonth && "text-slate-300",
                isCurrentMonth && !isSelected && !disabled && styles.hover,
                isCurrentMonth && !isSelected && !disabled && "text-slate-700",
                isSelected && styles.selected,
                isTodayDate && !isSelected && styles.today,
                disabled && "cursor-not-allowed opacity-30",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Time panel ────────────────────────────────────────────────────────────────

function TimePanel({
  value,
  onChange,
  onClose,
  styles: stylesProp,
  accent,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  styles?: AccentStyle;
  accent?: string;
}) {
  const styles = stylesProp ?? resolveAccentStyles(accent);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(
      `[data-time="${value}"]`,
    );
    active?.scrollIntoView({ block: "center" });
  }, [value]);

  return (
    <div className="w-full min-w-[200px] max-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
      <div className="mb-1.5 flex flex-wrap gap-1.5 px-1 pt-0.5">
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            const rounded =
              now.getMinutes() < 30
                ? `${String(now.getHours()).padStart(2, "0")}:00`
                : `${String(now.getHours()).padStart(2, "0")}:30`;
            onChange(rounded);
            onClose();
          }}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
            styles.chip,
          )}
        >
          Now
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onClose();
            }}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div ref={listRef} className="max-h-[260px] overflow-y-auto overscroll-contain pr-0.5">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            data-time={preset.value}
            onClick={() => {
              onChange(preset.value);
              onClose();
            }}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left text-sm transition",
              value === preset.value
                ? styles.selected
                : "text-slate-700 hover:bg-slate-50",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-2 border-t border-slate-100 px-1 pt-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Exact time
          </span>
          <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </label>
        <button
          type="button"
          onClick={onClose}
          className={cn("mt-2 w-full text-center text-xs font-semibold", styles.soft)}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Shared field shell ────────────────────────────────────────────────────────

const DATE_PANEL_WIDTH = 300;
const TIME_PANEL_WIDTH = 220;
const PANEL_EDGE_PAD = 12;
const PANEL_GAP = 8;
const PANEL_EST_HEIGHT = 340;

function PickerField({
  label,
  required,
  open,
  onToggle,
  display,
  placeholder,
  icon: Icon,
  accent,
  styles: stylesProp,
  hasValue,
  onClear,
  disabled,
  panel,
  className,
  panelWidth = DATE_PANEL_WIDTH,
}: {
  label?: string;
  required?: boolean;
  open: boolean;
  onToggle: () => void;
  display: string;
  placeholder: string;
  icon: typeof CalendarDays;
  accent?: string;
  styles?: AccentStyle;
  hasValue: boolean;
  onClear: () => void;
  disabled?: boolean;
  panel: ReactNode;
  className?: string;
  /** Estimated panel width used for edge clamping (date ~300, time ~220). */
  panelWidth?: number;
}) {
  // Keep the field render-safe even if a caller passes an incomplete style prop.
  const styles = stylesProp ?? resolveAccentStyles(accent) ?? SLATE_STYLES;
  const buttonId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Portal + fixed placement so the calendar is never clipped by workspace
  // shells (overflow-x: hidden on main scroll) or right-edge form columns.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPanelStyle(null);
      return;
    }

    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = Math.min(
        panelWidth,
        Math.max(200, window.innerWidth - PANEL_EDGE_PAD * 2),
      );
      const measuredHeight =
        panelRef.current?.getBoundingClientRect().height || PANEL_EST_HEIGHT;
      const gap = PANEL_GAP;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp =
        spaceBelow < measuredHeight && spaceAbove > spaceBelow;

      // Prefer aligning to the trigger; flip left when near the right edge.
      let left = rect.left;
      if (left + width > window.innerWidth - PANEL_EDGE_PAD) {
        left = rect.right - width;
      }
      left = Math.min(
        Math.max(PANEL_EDGE_PAD, left),
        window.innerWidth - width - PANEL_EDGE_PAD,
      );

      const top = openUp
        ? Math.max(PANEL_EDGE_PAD, rect.top - gap - measuredHeight)
        : Math.min(
            rect.bottom + gap,
            window.innerHeight - measuredHeight - PANEL_EDGE_PAD,
          );

      setPanelStyle({
        position: "fixed",
        left,
        top,
        width,
        zIndex: 200,
      });
    }

    place();
    // Re-measure after paint once the panel has real height.
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, panelWidth]);

  const portalPanel =
    open && mounted && panelStyle
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            style={panelStyle}
            className="max-w-[calc(100vw-1.5rem)]"
            data-datepicker-panel
          >
            {panel}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative", className)} data-datepicker-field>
      {label ? (
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
      ) : null}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition",
          "hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
          open && (styles?.ring || SLATE_STYLES.ring),
          !hasValue && "text-slate-400",
          hasValue && "text-slate-800",
          disabled && "cursor-not-allowed bg-slate-50 opacity-60",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            styles?.icon || SLATE_STYLES.icon,
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {hasValue ? display : placeholder}
        </span>
        {hasValue && !disabled ? <TriggerClear onClear={onClear} /> : null}
      </button>
      {portalPanel}
    </div>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DateTimePickerProps {
  dateValue: string;
  timeValue: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  dateLabel?: string;
  timeLabel?: string;
  /** Optional theme key; unknown values fall back to slate monochrome. */
  accent?: Accent | string;
  minDate?: string;
  maxDate?: string;
  /** When false, only the date control is shown. Default true for backward compat. */
  showTime?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  datePlaceholder?: string;
  timePlaceholder?: string;
}

function isInsideDatePickerSurface(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-datepicker-panel], [data-datepicker-field]"));
}

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  dateLabel = "Date",
  timeLabel = "Time",
  accent = "slate",
  minDate,
  maxDate,
  showTime = true,
  required,
  disabled,
  className,
  datePlaceholder = "Pick a date",
  timePlaceholder = "Pick a time",
}: DateTimePickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  // Resolve once per render; PickerField also re-resolves as a safety net.
  const styles = resolveAccentStyles(accent) || SLATE_STYLES;
  const selectedDate = parseDateSafe(dateValue);

  useEffect(() => {
    if (!calendarOpen && !timeOpen) return;

    function handlePointer(event: MouseEvent | TouchEvent) {
      // Panels are portaled to document.body — do not treat them as outside.
      if (isInsideDatePickerSurface(event.target)) return;
      setCalendarOpen(false);
      setTimeOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCalendarOpen(false);
        setTimeOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [calendarOpen, timeOpen]);

  return (
    <div
      className={cn(
        "relative grid gap-3",
        showTime ? "sm:grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      <PickerField
        label={dateLabel}
        required={required}
        open={calendarOpen}
        onToggle={() => {
          if (disabled) return;
          setCalendarOpen((open) => !open);
          setTimeOpen(false);
        }}
        display={
          selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : ""
        }
        placeholder={datePlaceholder}
        icon={CalendarDays}
        accent={accent}
        styles={styles}
        hasValue={Boolean(dateValue)}
        onClear={() => {
          onDateChange("");
          setCalendarOpen(false);
        }}
        disabled={disabled}
        panelWidth={DATE_PANEL_WIDTH}
        panel={
          <DateCalendarPanel
            value={dateValue}
            onChange={onDateChange}
            onClose={() => setCalendarOpen(false)}
            accent={accent}
            minDate={minDate}
            maxDate={maxDate}
            styles={styles}
          />
        }
      />

      {showTime ? (
        <PickerField
          label={timeLabel}
          open={timeOpen}
          onToggle={() => {
            if (disabled) return;
            setTimeOpen((open) => !open);
            setCalendarOpen(false);
          }}
          display={formatTimeLabel(timeValue)}
          placeholder={timePlaceholder}
          icon={Clock3}
          accent={accent}
          styles={styles}
          hasValue={Boolean(timeValue)}
          onClear={() => {
            onTimeChange("");
            setTimeOpen(false);
          }}
          disabled={disabled}
          panelWidth={TIME_PANEL_WIDTH}
          panel={
            <TimePanel
              value={timeValue}
              onChange={onTimeChange}
              onClose={() => setTimeOpen(false)}
              styles={styles}
            />
          }
        />
      ) : null}
    </div>
  );
}

export interface DateOnlyPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  accent?: Accent | string;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/** Single date field — no time column (use this for hire / enrollment / due dates). */
export function DateOnlyPicker({
  value,
  onChange,
  label = "Date",
  accent = "slate",
  minDate,
  maxDate,
  required,
  disabled,
  className,
  placeholder = "Pick a date",
}: DateOnlyPickerProps) {
  return (
    <DateTimePicker
      dateValue={value}
      timeValue=""
      onDateChange={onChange}
      onTimeChange={() => {}}
      dateLabel={label}
      showTime={false}
      accent={accent}
      minDate={minDate}
      maxDate={maxDate}
      required={required}
      disabled={disabled}
      className={className}
      datePlaceholder={placeholder}
    />
  );
}

export interface TimeOnlyPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  accent?: Accent;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/** Single time field for optional end times and schedule slots. */
export function TimeOnlyPicker({
  value,
  onChange,
  label = "Time",
  accent = "slate",
  required,
  disabled,
  className,
  placeholder = "Pick a time",
}: TimeOnlyPickerProps) {
  const [open, setOpen] = useState(false);
  const styles = resolveAccentStyles(accent);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent | TouchEvent) {
      if (isInsideDatePickerSurface(event.target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <PickerField
        label={label}
        required={required}
        open={open}
        onToggle={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        display={formatTimeLabel(value)}
        placeholder={placeholder}
        icon={Clock3}
        accent={accent}
        styles={styles}
        hasValue={Boolean(value)}
        onClear={() => {
          onChange("");
          setOpen(false);
        }}
        disabled={disabled}
        panelWidth={TIME_PANEL_WIDTH}
        panel={
          <TimePanel
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
            styles={styles}
          />
        }
      />
    </div>
  );
}
