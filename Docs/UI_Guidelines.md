# Notepad Flux UI/UX Guidelines

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
- **Background Primary**: `#202020` (Editor background)
- **Background Secondary**: `#1e1e1e` (Sidebar, Menu bar)
- **Text Normal**: `#dadada`
- **Text Muted**: `#999999`
- **Accent**: `#7f6df2` (Primary action color)

### Base Colors (Light Mode)
- **Background Primary**: `#ffffff`
- **Background Secondary**: `#f2f3f5`
- **Text Normal**: `#2e3338`
- **Text Muted**: `#888888`
- **Accent**: `#705dcf`

### Usage Guidelines
- Always use CSS variables (e.g., `var(--background-primary)`) instead of hardcoded hex values.
- Use `var(--interactive-accent)` for primary buttons and active states.
- Use `var(--text-error)` for destructive actions or error messages.

---

## 3. Fluent Design Elements

### 3.1 Geometry & Shape
- **Corner Radius**:
  - Small elements (buttons, inputs): `var(--radius-s)` (2px)
  - Medium elements (menus, dialogs): `var(--radius-m)` (4px)
  - Large containers: `var(--radius-l)` (6px)
  - Round elements (avatars, icon buttons): `var(--radius-round)` (50%)

### 3.2 Depth & Elevation
Use shadows to create hierarchy and depth.
- **Level 1 (Dropdowns, Tooltips)**: `var(--shadow-m)`
- **Level 2 (Modals, Dialogs)**: `var(--shadow-l)`
- **Level 3 (Floating Action Buttons)**: `var(--shadow-xl)`

### 3.3 Materials (Mica/Acrylic)
The application simulates Windows 11 Mica/Acrylic effects using backdrop filters.
- **Menu Bar & Status Bar**: Use `var(--mica-background)` with `backdrop-filter: blur(var(--mica-blur))`.
- **Dropdowns & Context Menus**: Use `var(--mica-background-alt)` for slightly higher opacity.

### 3.4 Motion
Transitions should be smooth and natural.
- **Hover effects**: `var(--transition-fast)` (100ms)
- **Menu opening/closing**: `var(--transition-normal)` (200ms)
- **Page transitions**: `var(--transition-smooth)` (400ms)

---

## 4. Component Guidelines

### 4.1 Layout Structure
- **Top Bar**: Contains Tabs and Menu Bar stacked vertically.
- **Order**: Tabs (top) -> Menu Bar (middle) -> Editor (bottom).
- **Connection**: The active tab visually connects to the menu bar by sharing the same background color (`var(--background-secondary)`).

### 4.2 Tabs
- **Height**: 40px
- **Shape**: Rounded top corners (`var(--radius-m)`).
- **Active State**:
  - Background matches Menu Bar (`var(--background-secondary)`).
  - Accent color top border (2px).
  - No bottom border (blends with Menu Bar).
- **Inactive State**: Transparent background, text muted.
- **Close Button**: Appears on hover, circular shape.

### 4.3 Menu Bar
- **Height**: 30px
- **Background**: Secondary background with Mica effect.
- **Border**: No bottom border to blend with editor content area.
- **Interaction**: Items highlight on hover with `var(--radius-s)`.
- **Menus**: Dropdowns appear with a fade-in animation (`fadeIn`) and `var(--shadow-m)`.

### 4.3 Editor
- **Font**: Inter (UI) / JetBrains Mono (Code).
- **Line Height**: 1.5 for readability.
- **Width**: Centered content with `max-width` (configurable).
- **Live Preview**: Markdown syntax is hidden when inactive and revealed on cursor focus.

### 4.4 Status Bar
- **Height**: 24px
- **Background**: Secondary background with Mica effect.
- **Content**: Right-aligned, subtle information (line/col, encoding).

---

## 5. Layout & Spacing
- **Spacing Scale**:
  - `var(--space-xs)`: 4px
  - `var(--space-s)`: 8px
  - `var(--space-m)`: 12px
  - `var(--space-l)`: 16px
  - `var(--space-xl)`: 24px
- **Z-Index Layers**:
  - Base: 0
  - Dropdowns: 1000
  - Modals: 2000
  - Tooltips: 3000

---

## 6. Accessibility
- **Contrast**: Ensure text meets WCAG AA standards (4.5:1 ratio).
- **Focus States**: All interactive elements must have a visible focus state.
- **Keyboard Navigation**: Full support for keyboard shortcuts and menu navigation.
- **Screen Readers**: Use semantic HTML and ARIA labels where necessary.
