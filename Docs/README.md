# Documentation

Welcome to the Notepad Flux documentation. This directory contains comprehensive documentation for the project, organized by topic.

---

## 📚 Documentation Overview

### Core Documentation

| Document | Description |
|----------|-------------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System architecture, directory structure, data flows, and technical implementation details |
| **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** | Product specifications, UX behaviors, session management, and menu specifications |
| **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** | Design system including colors, typography, Fluent design elements, and accessibility guidelines |
| **[FEATURES.md](./FEATURES.md)** | Detailed documentation of Live Preview markdown features and behaviors |
| **[MARKDOWN_REFERENCE.md](./MARKDOWN_REFERENCE.md)** | Quick reference guide for supported Markdown syntax |

---

## 🎯 Document Purpose

### For Developers

- **Start with:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) to understand the system structure
- **Then read:** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) for UI/UX implementation guidelines
- **Reference:** [`FEATURES.md`](./FEATURES.md) when implementing or modifying markdown features

### For Designers

- **Start with:** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) for design tokens and component specs
- **Then read:** [`SPECIFICATIONS.md`](./SPECIFICATIONS.md) for UX behavior requirements
- **Reference:** [`FEATURES.md`](./FEATURES.md) to understand feature interactions

### For Product Managers

- **Start with:** [`SPECIFICATIONS.md`](./SPECIFICATIONS.md) for product requirements
- **Then read:** [`FEATURES.md`](./FEATURES.md) to understand feature capabilities
- **Reference:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) for technical constraints and scalability

### For Users

- **Start with:** [`MARKDOWN_REFERENCE.md`](./MARKDOWN_REFERENCE.md) for markdown syntax help
- **Reference:** [`FEATURES.md`](./FEATURES.md) to understand advanced features

---

## 🔄 Document Relationships

```
ARCHITECTURE.md
    ↓ implements
DESIGN_SYSTEM.md ←→ SPECIFICATIONS.md
    ↓ defines              ↓ specifies
FEATURES.md ←──────────────┘
    ↓ documents syntax for
MARKDOWN_REFERENCE.md
```

---

## 📝 Keeping Documentation Updated

### When to Update

- **ARCHITECTURE.md**: When making significant changes to system structure, data flow, or core modules
- **SPECIFICATIONS.md**: When adding/changing UX behaviors, menu items, or product requirements
- **DESIGN_SYSTEM.md**: When adding new design tokens, components, or updating visual styles
- **FEATURES.md**: When adding/modifying markdown features or Live Preview behaviors
- **MARKDOWN_REFERENCE.md**: When adding support for new markdown syntax

### How to Update

1. Make your code changes
2. Update the relevant documentation file(s)
3. Update the "Last Updated" date at the top of the file
4. If adding new cross-references, update all related files
5. Include documentation updates in your pull request

---

## 🎨 Documentation Standards

All documentation in this directory follows these standards:

- **Format**: Markdown (.md files)
- **Naming**: SCREAMING_SNAKE_CASE for technical docs, Title_Case for references
- **Structure**: 
  - Frontmatter with project name and last updated date
  - Table of contents for documents >500 lines
  - Cross-references to related documents at the bottom
- **Style**: 
  - Use tables for structured information
  - Use code blocks for examples
  - Use emoji sparingly and consistently
  - Use proper heading hierarchy (don't skip levels)

---

## 🤝 Contributing

When contributing to this documentation:

1. **Be Clear**: Write for clarity, not brevity
2. **Be Specific**: Use examples and concrete details
3. **Be Consistent**: Follow the existing style and structure
4. **Be Complete**: Cover edge cases and common questions
5. **Be Current**: Remove outdated information promptly

---

## 📧 Questions?

If you can't find what you're looking for in these docs, please:
1. Check the main project README
2. Search existing GitHub issues
3. Open a new issue with the `documentation` label

---

*This documentation is maintained by the Notepad Flux team and community contributors.*
