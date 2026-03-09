

# Sliding Highlight Bar in Bottom Nav

Use `useRef` to measure each tab button's position, then render an absolutely-positioned highlight pill behind the active tab. Animate it with CSS `transition` on `left` and `width` properties using `layoutEffect` to update coordinates on route change.

## Changes — `src/components/BottomNav.tsx`

- Add `useRef` for the nav container and `useState` for `{ left, width }` of the active indicator
- Use `useEffect` keyed on `location.pathname` to find the active button element and read its `offsetLeft`/`offsetWidth`
- Render an absolute-positioned `<div>` with `bg-primary rounded-full` that transitions `left` and `width` over ~300ms with an ease-out curve
- Remove the inline `bg-primary` class from active buttons — they only change text/icon color now
- The sliding pill sits behind buttons via lower `z-index` or render order

This gives a smooth sliding pill effect when switching tabs, with no extra dependencies.

