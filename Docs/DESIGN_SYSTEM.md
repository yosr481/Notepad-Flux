# Design System

**Project:** Notepad Flux  
**Last Updated:** 2025-12-11

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Fluent Design Elements](#fluent-design-elements)
4. [Component Guidelines](#component-guidelines)
5. [Layout & Spacing](#layout--spacing)
6. [Typography](#typography)
7. [Accessibility](#accessibility)

---

## 1. Design Philosophy

Notepad Flux combines the simplicity of Windows Notepad with the modern aesthetics of Obsidian and the Fluent Design System. The goal is to create a distraction-free, premium writing experience that feels native to modern operating systems.

### Core Principles

- **Minimalism**: The interface should be clean and uncluttered. Controls should appear only when needed.
- **Flux Aesthetics**: Utilize **Flux Violet** brand colors, sleek gradients, and sophisticated motion to create a premium feel.
- **Live Preview First**: The editor focuses on content, with syntax markers receding until active interaction.

---

## 2. Color System

The application uses a semantic color system based on the **Flux Design System**, prioritized for a premium, distraction-free writing experience. All colors are defined as CSS variables in `src/styles/variables.css`.

### Base Colors (Brand)

| Variable | Color | Usage |
|----------|-------|-------|
| `--color-flux-violet` | `#7C3AED` | Primary brand color |
| `--color-flux-violet-surface` | `#F5F3FF` | Active selection backgrounds |
| `--color-editor-white` | `#FFFFFF` | Canvas background |

### Base Colors (Slate Neutral)

| Variable | Color | Usage |
|----------|-------|-------|
| `--color-slate-800` | `#1E293B` | Primary text |
| `--color-slate-500` | `#64748B` | Secondary text |
| `--color-slate-200` | `#E2E8F0` | Borders/Dividers |
| `--color-slate-50` | `#F8FAFC` | App background |

### Semantic Color Variables

#### Text Colors
- `--text-normal`: Primary text color
- `--text-muted`: Secondary/muted text
- `--text-faint`: Very faint text (syntax markers)
- `--text-accent`: Accent color (links, bullets)
- `--text-error`: Error messages and destructive actions
- `--text-highlight-bg`: Highlight background for `==text==`

#### Background Colors
- `--background-primary`: Main background
- `--background-secondary`: Secondary background (code, tables)
- `--background-modifier-border`: Border color

#### Interactive Colors
- `--interactive-accent`: Primary action color
- `--interactive-hover`: Hover state color
- `--text-selection`: Selection highlight

#### Special Purpose
- `--blockquote-border`: Blockquote left border

### Usage Guidelines

✅ **Do:**
- Always use CSS variables (e.g., `var(--background-primary)`)
- Use `var(--interactive-accent)` for primary buttons and active states
- Use `var(--text-error)` for destructive actions or error messages

❌ **Don't:**
- Never use hardcoded hex values
- Don't create new colors without adding them to the variable system
- Avoid using opacity to create color variations (use defined variables instead)

---

## 3. Fluent Design Elements

### 3.1 Geometry & Shape

**Corner Radius:**
- Small elements (buttons, inputs): `var(--radius-s)` (4px)
- Medium elements (menus, dialogs): `var(--radius-m)` (6px)
- Large containers: `var(--radius-l)` (8px)
- Round elements (avatars, icon buttons): `var(--radius-round)` (50%)

### 3.2 Depth & Elevation

Use shadows to create hierarchy and depth.

| Level | Variable | Usage |
|-------|----------|-------|
| Level 1 | `var(--shadow-s)` | Subtle depth |
| Level 2 | `var(--shadow-m)` | Dropdowns, Context Menus |
| Level 3 | `var(--shadow-image)` | Images, Modals |
| Focus | `var(--shadow-focus)` | Active input states |

### 3.3 Materials (Mica/Acrylic)

The application simulates Windows 11 Mica/Acrylic effects using backdrop filters.

**Menu Bar & Status Bar:**
- Use `var(--mica-background)` with `backdrop-filter: blur(var(--mica-blur))`

**Dropdowns & Context Menus:**
- Use `var(--mica-background-alt)` for slightly higher opacity

### 3.4 Motion & Transitions

Transitions should be smooth and natural.

| Speed | Variable | Usage |
|-------|----------|-------|
| Fast | `var(--transition-fast)` (100ms) | Hover effects |
| Normal | `var(--transition-normal)` (150ms) | UI element reveals |
| Slow | `var(--transition-slow)` (200ms) | Layout changes, Tab reorder |

**Easing:**
- Use `ease-in-out` for most transitions
- Use `ease-out` for elements entering the screen
- Use `ease-in` for elements leaving the screen

---

## 4. Component Guidelines

### 4.1 Layout Structure

**Top Bar:**
- Contains Tabs and Menu Bar stacked vertically
- Order: Tabs (top) → Menu Bar (middle) → Editor (bottom)
- **Visual Connection**: The active tab connects seamlessly to the canvas.

### 4.2 Tabs

**Dimensions:**
- Height: `40px`
- Min width: `100px`
- Max width: `200px`

**Shape:**
- Rounded top corners: `var(--radius-m)`
- No bottom border (blends with Menu Bar)

**Active State:**
- Background: `var(--background-primary)` (White)
- Top Border: `2px solid var(--color-flux-violet)`
- Rounded Corners: 8px top radius
- No bottom border

**Inactive State:**
- Background: transparent
- Text: `var(--text-muted)`
- Hover: subtle background highlight

**Close Button:**
- Appears on hover
- Circular shape
- Size: `20px`

### 4.3 Menu Bar

**Dimensions:**
- Height: `40px`
- Full width

**Styling:**
- Background: Secondary background with Mica effect
- Border: No bottom border to blend with editor content area

**Menu Items:**
- Padding: `var(--space-s)` horizontal
- Hover: Highlight with `var(--radius-s)`
- Active: Background `var(--background-modifier-border)`

**Dropdowns:**
- Appear with fade-in animation (`fadeIn`)
- Shadow: `var(--shadow-m)`
- Min width: `200px`
- Padding: `var(--space-s)`

### 4.4 Editor

**Typography:**
- Font: Inter (UI) / JetBrains Mono (Code)
- Line Height: `1.5` for readability
- Font size: `16px` base

**Content Width:**
- Centered content with optional `max-width` (configurable in settings)

**Live Preview:**
- Markdown syntax is hidden when inactive and revealed on cursor focus
- See [`FEATURES.md`](./FEATURES.md) for detailed behavior

### 4.5 Status Bar

**Dimensions:**
- Height: `28px`
- Full width

**Styling:**
- Background: Secondary background with Mica effect
- Text: `var(--text-muted)`
- Font size: `12px`

**Content:**
- Right-aligned
- Displays: line/col, encoding, word count

---

## 5. Layout & Spacing

### Spacing Scale

Use the spacing scale for consistent margins and padding:

| Variable | Value | Usage |
|----------|-------|-------|
| `var(--space-xs)` | 4px | Tight spacing, icon padding |
| `var(--space-s)` | 8px | Small gaps, button padding |
| `var(--space-m)` | 12px | Default spacing |
| `var(--space-l)` | 16px | Section spacing |
| `var(--space-xl)` | 24px | Large gaps, page margins |

### Z-Index Layers

Maintain consistent layering across the application:

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base | 0 | Default content |
| Elevated | 100 | Sticky headers |
| Dropdowns | 1000 | Menus, select dropdowns |
| Modals | 2000 | Dialog boxes, overlays |
| Tooltips | 4000 | Tooltips |
| Notifications | 5000 | Notifications, toasts |

---

## 6. Typography

### Font Families

**UI Text:**
```css
font-family: 'Inter', system-ui, sans-serif;
```

**Serif (Optional Writing Mode):**
```css
font-family: 'Merriweather', 'Newsreader', serif;
```

**Monospace (Code):**
```css
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### Font Sizes

| Element | Size | Line Height |
|---------|------|-------------|
| H1 | 1.6em | 1.2 |
| H2 | 1.4em | 1.3 |
| H3 | 1.2em | 1.4 |
| H4 | 1.1em | 1.4 |
| H5 | 1.0em | 1.5 |
| H6 | 0.9em | 1.5 |
| Body | 16px | 1.5 |
| Small | 14px | 1.5 |
| Code | 0.9em | 1.6 |

### Font Weights

- Regular: `400`
- Medium: `500`
- Semibold: `600`
- Bold: `700`

---

## 7. Accessibility

### Contrast Requirements

Ensure all text meets WCAG AA standards:
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (18pt+): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

### Focus States

All interactive elements must have a visible focus state:
- **Outline**: `2px solid var(--interactive-accent)`
- **Offset**: `2px`
- Never remove focus outlines with `outline: none` without providing an alternative

### Keyboard Navigation

**Tab Order:**
- Logical tab order following visual layout
- Skip links for keyboard-only users
- All functionality accessible via keyboard

**Keyboard Shortcuts:**
- Standard shortcuts should follow OS conventions
- Custom shortcuts should be documented
- Shortcuts should not conflict with browser/OS shortcuts

### Screen Readers

**Semantic HTML:**
- Use proper heading hierarchy (`h1` → `h2` → `h3`)
- Use semantic elements (`<nav>`, `<main>`, `<aside>`)
- Use `<button>` for clickable actions, not `<div>`

**ARIA Labels:**
- Provide `aria-label` for icon-only buttons
- Use `aria-describedby` for additional context
- Use `role` attribute when semantic HTML is insufficient

### Color Independence

- Don't rely solely on color to convey information
- Use icons, text, or patterns in addition to color
- Ensure color blind users can distinguish states

---

## 8. Animation Guidelines

### Performance

- Prefer `transform` and `opacity` for animations (GPU accelerated)
- Avoid animating `width`, `height`, `top`, `left` (causes reflow)
- Use `will-change` sparingly and only when necessary

### Reduced Motion

Respect user preferences:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Cross-References

- For architectural implementation details, see [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- For UX behavior specifications, see [`SPECIFICATIONS.md`](./SPECIFICATIONS.md)
- For markdown styling details, see [`FEATURES.md`](./FEATURES.md)

---

*This design system should be the single source of truth for all visual and interaction design decisions in Notepad Flux.*
