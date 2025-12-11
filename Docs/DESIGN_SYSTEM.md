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
- **Fluent Design**: Incorporate modern design elements like rounded corners, depth (shadows), motion (transitions), and material effects (Mica/Acrylic).
- **Obsidian Compatibility**: The color palette must strictly adhere to Obsidian's default theme colors to ensure familiarity for Obsidian users.

---

## 2. Color System

The application uses a semantic color system based on Obsidian's default theme. All colors are defined as CSS variables in `src/styles/variables.css`.

### Base Colors (Dark Mode)

| Variable | Color | Usage |
|----------|-------|-------|
| `--background-primary` | `#202020` | Editor background |
| `--background-secondary` | `#1e1e1e` | Sidebar, Menu bar |
| `--text-normal` | `#dadada` | Primary text color |
| `--text-muted` | `#999999` | Secondary/faint text |
| `--interactive-accent` | `#7f6df2` | Primary action color |

### Base Colors (Light Mode)

| Variable | Color | Usage |
|----------|-------|-------|
| `--background-primary` | `#ffffff` | Editor background |
| `--background-secondary` | `#f2f3f5` | Sidebar, Menu bar |
| `--text-normal` | `#2e3338` | Primary text color |
| `--text-muted` | `#888888` | Secondary/faint text |
| `--interactive-accent` | `#705dcf` | Primary action color |

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
- Small elements (buttons, inputs): `var(--radius-s)` (2px)
- Medium elements (menus, dialogs): `var(--radius-m)` (4px)
- Large containers: `var(--radius-l)` (6px)
- Round elements (avatars, icon buttons): `var(--radius-round)` (50%)

### 3.2 Depth & Elevation

Use shadows to create hierarchy and depth.

| Level | Variable | Usage |
|-------|----------|-------|
| Level 1 | `var(--shadow-m)` | Dropdowns, Tooltips |
| Level 2 | `var(--shadow-l)` | Modals, Dialogs |
| Level 3 | `var(--shadow-xl)` | Floating Action Buttons |

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
| Normal | `var(--transition-normal)` (200ms) | Menu opening/closing |
| Smooth | `var(--transition-smooth)` (400ms) | Page transitions |

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
- **Connection**: The active tab visually connects to the menu bar by sharing the same background color (`var(--background-secondary)`)

### 4.2 Tabs

**Dimensions:**
- Height: `40px`
- Min width: `120px`
- Max width: `200px`

**Shape:**
- Rounded top corners: `var(--radius-m)`
- No bottom border (blends with Menu Bar)

**Active State:**
- Background matches Menu Bar: `var(--background-secondary)`
- Accent color top border: `2px solid var(--interactive-accent)`
- No bottom border (blends with Menu Bar)
- Text: `var(--text-normal)`

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
- Height: `30px`
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
- Height: `24px`
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
| Tooltips | 3000 | Tooltips, notifications |

---

## 6. Typography

### Font Families

**UI Text:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
```

**Monospace (Code):**
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
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
