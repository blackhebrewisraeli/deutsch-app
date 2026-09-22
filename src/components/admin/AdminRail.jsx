import { useRef } from 'react';
import { RAIL, railItemStyle } from './adminStyles';

/**
 * A real tablist: roving tabindex, arrow/Home/End keys, and aria-controls
 * pointing at the panel each tab owns.
 *
 * `aria-pressed` buttons would have been half the code, but they announce as
 * toggles rather than as a set of destinations, and they leave every hidden
 * section's tab in the Tab order. Fourteen league rows once shipped as
 * `<li onClick>` through a green suite; this is the same lesson applied before
 * the fact.
 */
export function AdminRail({ items, activeKey, onPick, ariaLabel, panelId }) {
  const refs = useRef({});

  const onKeyDown = (e) => {
    const keys = items.map((i) => i.key);
    const at = keys.indexOf(activeKey);
    let next = null;
    if (e.key === 'ArrowRight') next = keys[(at + 1) % keys.length];
    else if (e.key === 'ArrowLeft') next = keys[(at - 1 + keys.length) % keys.length];
    else if (e.key === 'Home') next = keys[0];
    else if (e.key === 'End') next = keys[keys.length - 1];
    if (next == null) return;
    e.preventDefault();
    onPick(next);
    // Selection follows focus here, which is the ARIA-recommended pattern for a
    // tablist whose panels are already mounted — and is safe precisely because
    // every panel is cheap. Do NOT copy this to a control where landing on an
    // option commits something: selection-follows-focus is what once made B1
    // unreachable by keyboard on the level picker.
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} style={RAIL} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[item.key] = el;
            }}
            type="button"
            role="tab"
            data-ui="admin-rail-item"
            aria-selected={active}
            aria-controls={`${panelId}-${item.key}`}
            id={`${panelId}-tab-${item.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onPick(item.key)}
            style={railItemStyle(active)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The same rule, for a set of filters rather than a set of destinations.
 *
 * A filter is a toggle over what one panel shows, so these stay ordinary
 * buttons with `aria-pressed` and stay in the Tab order — swapping the filter
 * does not change which region of the page you are in, and a tablist would say
 * that it did.
 */
export function AdminFilterRail({ options, activeKey, onPick, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} style={RAIL}>
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <button
            key={option.key || 'all'}
            type="button"
            data-ui="admin-rail-item"
            aria-pressed={active}
            onClick={() => onPick(option.key)}
            style={railItemStyle(active)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
