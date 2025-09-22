# 3BT Document Assembly Electron App - Development Guide

## Project Overview
Desktop application for 3 Big Things that enables seamless document assembly from modular page templates, with native OneDrive access, persistent storage, and professional export capabilities.

## Core Architecture Decisions

### 1. Template System
- **Master Templates**: Read-only templates stored in `/Templates/[TemplateName]/pages/`
- **Template Upload**: Admin uploads individual page HTML files + metadata.json per template
- **Template Isolation**: Projects create copies of templates on first use to protect originals
- **Template Discovery**: Automatic scanning of template folders on app startup
- **No Template Creation**: Users cannot create templates via app (admin adds to core folder)

### 2. Project Management
- **Project Files**: `.3bt` format containing all project data and template copies
- **Single User Access**: File-based locking prevents concurrent editing
- **User-Named Projects**: Prompt user for project name when creating new project
- **Auto-save**: Save project changes every 30 seconds during active editing

### 3. Metadata Structure

#### Template Metadata (`/Templates/[Name]/metadata.json`)
```json
{
  "name": "Proposal Template",
  "category": "proposal",
  "version": "1.0",
  "created": "2025-01-19",
  "description": "Standard client proposal format",
  "pages": ["cover", "team", "services", "cta"],
  "locked": false
}
```
**Purpose**: Template categorization, UI organization, version tracking

#### Page Metadata (HTML data attributes)
```html
<div data-page-template="cover"
     data-page-category="intro"
     data-page-type="hero"
     data-locked="false"
     style="display: none;"></div>
```
**Purpose**: Page identification, editing behavior, UI sorting

### 4. File System Structure
```
~/Library/CloudStorage/OneDrive-Unimed/3 Big Things Management Folder/Brand/Brochure/Document Assembly/
├── Templates/                    # Master templates (admin uploads)
│   ├── Proposal Template/
│   │   ├── metadata.json        # Template info (uploaded by admin)
│   │   └── pages/               # Individual page files (uploaded by admin)
│   │       ├── page-01-cover.html
│   │       ├── page-03-team.html
│   │       └── page-09-cta.html
│   └── Quote Template/
│       ├── metadata.json
│       └── pages/
│           ├── page-01-cover.html
│           └── page-02-pricing.html
├── Images/                       # Image library
│   ├── 3bigthings_images_summary.csv
│   └── cache/                   # Local thumbnails
├── Projects/                    # Active .3bt project files
│   ├── project-name.3bt
│   └── project-name.3bt.lock
├── Exports/                     # Generated documents
│   └── [YYYY-MM-DD]-[Client]-[Project]/
│       ├── source.html         # Full document HTML
│       ├── preview.html        # Preview version
│       ├── final.pdf          # PDF export
│       └── affinity-ready.html # Print-ready version
└── Config/                     # App configuration
    └── settings.json
```

### 5. Export Strategy
- **Preview Always Available**: Render current project state in preview pane
- **Export Preview**: Show modal dialog before final save
- **Affinity Integration**: Export print-ready HTML with bleed markers for Affinity Publisher
- **Folder Organization**: Exports organized by date-client-project structure
- **Lock File Cleanup**: Abandoned locks cleaned up after 2 hours (app crash recovery)

## Technical Stack & Requirements

### Core Technologies
- **Framework**: Electron v27+
- **Frontend**: Vanilla HTML5, CSS3, ES6+ JavaScript
- **Backend**: Node.js v18+, SQLite (main process), IndexedDB (renderer)
- **PDF Generation**: Puppeteer for high-quality A4 output
- **File Watching**: Chokidar for OneDrive sync monitoring

### Dependencies
```json
{
  "electron": "^27.0.0",
  "sqlite3": "^5.1.6",
  "puppeteer": "^21.0.0",
  "csv-parse": "^5.5.0",
  "chokidar": "^3.5.3"
}
```

## Coding Standards & Style Guide

### JavaScript Style
- **ES6+ Modules**: Use import/export syntax
- **Async/Await**: Prefer over Promises and callbacks
- **Error Handling**: Comprehensive try/catch with user-friendly messages
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **No Comments**: Keep code self-documenting through clear naming

### Architecture Goals & File Size Limits

#### SIMPLICITY PRINCIPLES
- **Single Responsibility**: Each module does ONE thing well
- **Maximum File Size**: 200 lines per module (absolute maximum 300 lines)
- **Maximum Class Size**: 150 lines per class
- **Maximum Function Size**: 30 lines per function
- **No Deep Nesting**: Maximum 3 levels of indentation

#### MODULE ARCHITECTURE RULES
```
ENFORCED LIMITS:
- Main renderer.js: ≤300 lines (currently 800+ - MUST reduce)
- Individual modules: ≤200 lines each
- Template functions: ≤50 lines each
- Event handlers: ≤20 lines each
- State operations: ≤30 lines each
```

#### COMPLEXITY CONSTRAINTS
- **No Monolithic Classes**: Break down any class >150 lines
- **Pure Functions Preferred**: Minimize side effects
- **Event-Driven Architecture**: Use EventBus for component communication
- **Immutable State Updates**: Never mutate state directly
- **Error Boundaries**: Every async operation wrapped in try/catch

### CSS Architecture
- **CSS Custom Properties**: Use for all brand colors and dimensions
- **BEM Methodology**: Block__Element--Modifier naming convention
- **Mobile-First**: Design for responsiveness (though desktop-focused)
- **Per-Page Styles**: Keep template styles isolated, consolidate only at export

### File Organization
```
/3bt-document-assembly/
├── package.json
├── main.js                     # Main Electron process
├── preload.js                  # IPC bridge
├── /src/
│   ├── index.html             # Main UI
│   ├── renderer.js            # Frontend logic
│   ├── /styles/
│   │   └── app.css           # Application UI styles only
│   └── /modules/
│       ├── templateManager.js  # Template loading/management
│       ├── documentBuilder.js  # Document assembly logic
│       ├── imageLibrary.js     # Image cache/management
│       └── exportManager.js    # Export functionality
├── /data/
│   ├── config.json           # User preferences
│   └── projects.db           # SQLite project metadata
└── /build/                   # Distribution files
```

## Brand Integration

### 3 Big Things Brand Colors
```css
:root {
  /* Primary Brand Colors */
  --color-teal: #0A6B7C;        /* Headers, links, primary UI */
  --color-teal-dark: #045563;   /* Footers, deep emphasis */
  --color-orange: #E68A2E;      /* CTAs, energy, highlights */
  --color-sand: #D4AE80;        /* Warm accents */
  --color-sand-light: #E8D4BC;  /* Subtle warmth */

  /* Supporting Colors */
  --color-warm-white: #FAF7F4;  /* Section backgrounds */
  --color-charcoal: #2E2E2E;    /* Body text */
  --color-cool-gray: #8C9A9E;   /* Secondary text */
  --color-soft-sage: #A9C1B5;   /* Calming sections */
}
```

### Typography
- **Headers**: Lora (serif) - 32pt/24pt/18pt/14pt
- **Body**: Source Sans 3 (sans-serif) - 11pt regular
- **UI Elements**: Source Sans 3 - weights 400/600/700

### Brand Essence
- **Mission**: Supporting workplace and individual wellbeing through evidence-based tools
- **Personality**: Warm, professional, empathetic, grounded in Māori wellness concepts
- **Values**: Clarity, compassion, cultural inclusivity, simplicity
- **Visual Identity**: Three interlocking peaks (orange, sand, teal) representing wellbeing pillars

## Print Integration

### Affinity Publisher Workflow
- **Bleed Markers**: Export HTML with CSS comments for 3mm bleed areas
- **Color Space**: Maintain RGB in HTML, note CMYK conversion needed in Affinity
- **Safe Zones**: 25mm margins for critical content, 15mm minimum for all content
- **Print Comments**: Embed print specifications in exported HTML

```css
/* Print-ready export markers */
.page {
  width: 210mm;
  height: 297mm;
  /* Bleed area markers for Affinity */
  outline: 3mm solid transparent;
  outline-offset: -3mm;
}
```

```html
<!-- PRINT_SPECIFICATIONS
Bleed: 3mm
Color: CMYK conversion required
Crop marks: Add in Affinity Publisher
Safe zone: 25mm margins maintained
-->
```

## Performance Requirements
- **Load Time**: 15-page document in <2 seconds
- **Preview**: Real-time preview generation in <3 seconds
- **Export**: PDF generation in <5 seconds
- **Auto-save**: Non-blocking background saves every 30 seconds
- **Image Cache**: Thumbnail generation and local storage for offline access

## Development Phases

### Phase 1: Core Foundation (4 days)
1. **Day 1**: Electron setup + OneDrive folder detection + basic UI
2. **Day 2**: Template discovery + project creation/management + page assembly
3. **Day 3**: Content editing + image library integration + styling per-page
4. **Day 4**: Export system + preview + auto-save + testing

### Future Enhancements
- **AWS Bedrock Integration**: AI-assisted template creation
- **Advanced Export**: Multiple format support
- **Collaboration**: Multi-user project sharing
- **Template Store**: Downloadable template packages

## Git Workflow
- **Main Branch**: Production-ready code only
- **Feature Branches**: `feature/template-loading`, `feature/export-system`
- **Commit Style**: Conventional commits (feat:, fix:, docs:, style:)
- **Release Tags**: Semantic versioning (v1.0.0, v1.1.0)

## Testing Strategy
- **Template Compatibility**: Test with all existing page templates
- **Export Quality**: Validate HTML/PDF output matches design specifications
- **File System**: Test OneDrive sync scenarios and offline behavior
- **Performance**: Load testing with maximum page count (15 pages)
- **Recovery**: Test auto-save and crash recovery scenarios

---

**Last Updated**: 2025-01-19
**Version**: 1.0
**Next Review**: After Phase 1 completion