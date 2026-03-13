

# Standardize "Get Insights" Button Styling

Only one button needs updating — the Together Chat floating button above the input. The rest already match the desired styles.

## Current vs Target

| Location | Current | Target | Action |
|---|---|---|---|
| F2F (above recording) | `secondary`, `w-full gap-2 rounded-xl` | Same | No change |
| Solo (closure) | default/primary | default/primary | No change |
| Solo (floating above input) | `secondary`, `w-full rounded-xl gap-2` | Same | No change |
| Together (closure) | default/primary | default/primary | No change |
| **Together (floating above input)** | `variant="outline"` + custom classes | `variant="secondary"` + `w-full rounded-xl gap-2` | **Update** |

## Change

**`src/components/conversation/TogetherChat.tsx` ~line 858-859**: Change `variant="outline"` to `variant="secondary"` and replace `className="w-full rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/5"` with `className="w-full rounded-xl gap-2"`.

