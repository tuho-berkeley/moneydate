

## Plan: Auto-hide Bottom Nav on Scroll

**Behavior**: Hide the bottom navbar when scrolling down (once greeting leaves viewport). Show it again immediately when user scrolls up.

### Changes

**`src/components/BottomNav.tsx`**:
- Add scroll listener tracking `lastScrollY` and scroll direction
- When scrolling down past a threshold (~80px), set `hidden = true`
- When scrolling up, set `hidden = false`
- Apply a translate-y transform with transition to slide the nav off-screen when hidden
- Use `transition-transform duration-300` for smooth animation

The nav container gets a conditional class like `translate-y-[calc(100%+1rem)]` when hidden, sliding it below the viewport edge.

