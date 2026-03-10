

## Plan: Cache Homepage Scroll Position

### Problem
When users switch tabs or return from an activity, the homepage resets to the top. They lose their place in the journey.

### Solution
Save the scroll position of the homepage to `sessionStorage` on scroll, and restore it when the component mounts.

### Changes

**`src/pages/Index.tsx`**
- Add a `useEffect` that listens to the `scroll` event and debounces saving `window.scrollY` to `sessionStorage` (key: `homepage_scrollY`)
- Add a `useEffect` on mount that reads the saved value and calls `window.scrollTo(0, savedY)` after content has loaded (wait for activities data to be ready)
- Use `requestAnimationFrame` or a short delay to ensure DOM is rendered before restoring

This pairs with the existing stage accordion caching — users will return to both the same scroll position and the same expanded stage.

