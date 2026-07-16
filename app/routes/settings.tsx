import React from "react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router";
import type { Route } from "./+types/settings";
import { useSettings } from "../context/UserData";

type SettingsOption = {
  id: string;
  title: string;
  description?: string;
  onSelect?: () => void;
};

type SettingsDropdownProps = {
  label: string;
  options: SettingsOption[];
};

type SettingsDropdownItemProps = {
  option: SettingsOption;
  showDescription: boolean;
  pinned: boolean;
  itemRef: (el: HTMLButtonElement | null) => void;
  onMouseEnterRow: () => void;
  onMouseLeaveRow: () => void;
  onFocusRow: () => void;
  onSelect: () => void;
  onTogglePinned: () => void;
};

type SettingsDropdownConfig = {
  id: string;
  label: string;
  options: SettingsOption[];
};

type SettingsGroupProps = {
  title: string;
  description?: string;
  dropdowns: SettingsDropdownConfig[];
};

export function meta(_args: Route.MetaArgs) {
	return [{ title: "Settings" }, { name: "description", content: "The settings page" }];
}

function ChevronDownIcon() { 
	return ( 
		<svg 
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		/*class="
			lucide
			lucide-chevron-down-icon
			lucide-chevron-down"*/
		>
			<path d="m6 9 6 6 6-6"/>
		</svg>
	); 
}

function InfoIcon() {
	return (
		<svg 
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10"/>
			<path d="M12 16v-4"/>
			<path d="M12 8h.01"/>
		</svg>
	);
}

function SettingsGroup({ title, description, dropdowns }: SettingsGroupProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 rounded-md border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
    >
      <h2 id={headingId} className="text-lg font-medium text-gray-900 dark:text-gray-100">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {dropdowns.map((dropdown) => (
          <SettingsDropdown
            key={dropdown.id}
            label={dropdown.label}
            options={dropdown.options}
          />
        ))}
      </div>
    </section>
  );
}

function SettingsDropdownItem({
  option,
  showDescription,
  pinned,
  itemRef,
  onMouseEnterRow,
  onMouseLeaveRow,
  onFocusRow,
  onSelect,
  onTogglePinned,
}: SettingsDropdownItemProps) {
  return (
    <div
      className="rounded-xl transition hover:bg-gray-50 dark:hover:bg-gray-800"
      onMouseEnter={onMouseEnterRow}
      onMouseLeave={onMouseLeaveRow}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        <button
          ref={itemRef}
          type="button"
          role="menuitem"
          onClick={onSelect}
          onFocus={onFocusRow}
          className="min-w-0 flex-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {option.title}
          </div>

          {showDescription && option.description && (
            <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-400">
              {option.description}
            </p>
          )}
        </button>

        {option.description && (
          <button
            type="button"
            aria-label={`Show description for ${option.title}`}
            aria-pressed={pinned}
            onClick={onTogglePinned}
            onFocus={onFocusRow}
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <InfoIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsDropdown({ label, options }: SettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setHoveredId(null);
    setPinnedId(null);
    setFocusedIndex(0);
  }

  function closeMenuAndFocusTrigger() {
    closeMenu();
    triggerRef.current?.focus();
  }

  function toggleMenu() {
    if (open) {
      closeMenu();
    } else {
      setOpen(true);
    }
  }

  function handleSelect(option: SettingsOption) {
    option.onSelect?.();
    closeMenuAndFocusTrigger();
  }

  function togglePinned(id: string) {
    setPinnedId((current) => (current === id ? null : id));
  }

  function focusItemAt(index: number) {
    itemRefs.current[index]?.focus();
  }

  function handleRootBlur(event: FocusEvent<HTMLDivElement>) {
    if (rootRef.current?.contains(event.relatedTarget as Node)) return;
    closeMenu();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const lastIndex = options.length - 1;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndFocusTrigger();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItemAt(focusedIndex < lastIndex ? focusedIndex + 1 : 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItemAt(focusedIndex > 0 ? focusedIndex - 1 : lastIndex);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusItemAt(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusItemAt(lastIndex);
    }
  }

  return (
    <div ref={rootRef} onBlur={handleRootBlur} className="relative w-full max-w-md">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
        <span
          className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="p-2">
            {options.map((option, index) => {
              const showDescription =
                Boolean(option.description) &&
                (hoveredId === option.id || pinnedId === option.id || focusedIndex === index);

              return (
                <SettingsDropdownItem
                  key={option.id}
                  option={option}
                  showDescription={showDescription}
                  pinned={pinnedId === option.id}
                  itemRef={(el) => { itemRefs.current[index] = el; }}
                  onMouseEnterRow={() => setHoveredId(option.id)}
                  onMouseLeaveRow={() =>
                    setHoveredId((current) => (current === option.id ? null : current))
                  }
                  onFocusRow={() => setFocusedIndex(index)}
                  onSelect={() => handleSelect(option)}
                  onTogglePinned={() => togglePinned(option.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
	// Clear is unused right now
	const [_cleared, setCleared] = React.useState(false);

	// For the header
	/*const [query, setQuery] = React.useState("");
	const [favoritesOnly, setFavoritesOnly] = React.useState(false);
	const [favoritesSet, setFavoritesSet] = React.useState<Set<string>>(new Set());*/

	const { setSettings } = useSettings();

	const clearFavorites = () => {
		setSettings((prev) => ({ ...prev, favorites: [] }));
		setCleared(true);
	};

	return (
		<main className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-white">
			<h1>Header will go here</h1>

			<div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-semibold">Settings</h1>

				<SettingsGroup title="Favorites" 
					description="Manage saved favorites for quick access." 
					dropdowns= {[
						{
						id: "favorites-dropdown",
						label: "Clear favorites",
						options: [
							{
								id: "clear-favorites",
								title: "Clear favorites",
								description: "Remove all saved favorites.",
								onSelect: clearFavorites
							}
						]
					}
				]}
				/>

				<div className="mt-6">
					<Link to="/" className="text-sm text-blue-600">
						Back to home
					</Link>
				</div>
			</div>
		</main>
	);
}
