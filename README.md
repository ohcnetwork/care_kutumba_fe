# care_kutumba_fe

A microfrontend plugin for [OHCN Care](https://github.com/ohcnetwork/care_fe) that integrates Kutumba (ration card) data lookups into the patient registration workflow. This module enables healthcare providers to pre-fill patient information using government ration card records.

## What is this?

This is a **module federation microfrontend** that cannot run standalone. It's designed to be consumed by the main Care FE application and provides:

- Patient registration form integration with Kutumba data lookup
- Ration card type mapping (BPL/APL classification)
- Patient information card actions with Kutumba member lookup
- Tag management for patient classifications (priority households, students, PWD)
- Support for multiple patient identifiers (RC number, Health ID, Education ID)

## Tech Stack

- React 19 + TypeScript
- Vite (build tool with module federation)
- Tailwind CSS + shadcn/ui
- React Hook Form
- Jotai (state management)
- TanStack React Query (data fetching)
- Raviger (routing)

## Prerequisites

- Node.js >= 22.9.0
- npm or yarn

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file based on `.env.example` and configure the following variables:

### Tag Configuration

These tag IDs are fetched from the Care backend's `/api/v1/tag_config/` endpoint. They determine which tags are applied to patients based on their ration card type.

#### `REACT_KUTUMBA_BPL_TAG_ID`

Tag ID for Below Poverty Line (BPL) households. When a patient's ration card type is "Priority Households", this tag is automatically applied to their record.

#### `REACT_KUTUMBA_APL_TAG_ID`

Tag ID for Above Poverty Line (APL) households. When a patient's ration card type is "Non-Priority Households", this tag is automatically applied to their record.

#### `REACT_KUTUMBA_STUDENT_UNVERIFIED_TAG_ID`

Tag ID for unverified student status. Applied to patients marked as students in Kutumba data but pending verification.

#### `REACT_KUTUMBA_PWD_UNVERIFIED_TAG_ID`

Tag ID for unverified Person with Disability (PWD) status. Applied to patients marked with disabilities in Kutumba data but pending verification.

### Identifier Configuration

These identifier IDs are fetched from the Care backend and map to specific patient identifier types in the system.

#### `REACT_KUTUMBA_RC_NUMBER_IDENTIFIER_ID`

Identifier configuration ID for the ration card (RC) number field. This determines which patient identifier field stores the ration card number fetched from Kutumba.

#### `REACT_KUTUMBA_HEALTH_ID_IDENTIFIER_ID`

Identifier configuration ID for the Health ID field. This determines which patient identifier field stores the health ID from Kutumba records.

#### `REACT_KUTUMBA_EDUCATION_ID_IDENTIFIER_ID`

Identifier configuration ID for the Education ID field. This determines which patient identifier field stores the education ID from Kutumba records.

### Behavior Configuration

#### `REACT_KUTUMBA_AUTO_SUBMIT_ON_FILL`

Controls whether the patient registration form automatically submits after filling data from Kutumba lookup.

- **Default**: `false` (disabled)
- **Values**: `"true"` to enable, any other value to disable
- **Use case**: Enable this if you want a streamlined workflow where users don't need to manually click submit after selecting a Kutumba member

## Development

### Start Development Server

```bash
npm start
```

This runs both the build watcher and preview server concurrently:
- Build watcher on file changes
- Preview server at http://localhost:11111

### Other Commands

```bash
npm run build          # Production build
npm run preview        # Preview production build
npm run lint           # Check code quality
npm run lint-fix       # Fix linting issues
npm run format         # Format code with Prettier
npm run sort-locales   # Sort translation files
```

## Project Structure

```
src/
├── apis/              # API route definitions
├── components/
│   ├── pluggables/    # Exported microfrontend components
│   ├── kutumba/       # Kutumba-specific components
│   └── ui/            # shadcn/ui components
├── hooks/             # Custom React hooks
├── lib/               # Utilities and helpers
├── state/             # Jotai atoms for state management
├── types/             # TypeScript type definitions
├── config.ts          # Environment variable configuration
├── manifest.ts        # Module federation manifest
└── routes.tsx         # Route definitions
```

## Module Federation

This plugin exposes the following components via module federation:

- `PatientRegistrationForm` - Form plugin for patient registration with Kutumba lookup
- `PatientInfoCardActions` - Patient card actions with Kutumba data integration

The manifest is available at the remote entry point for consumption by the main Care FE application.

## Integration with Care FE

This microfrontend is consumed by the main Care FE application through Vite's module federation. It cannot be accessed standalone - attempting to open `index.html` directly will show a warning page.

To integrate this module, the main application needs to:
1. Add this module as a remote in its module federation config
2. Import the manifest and register the components/routes
3. Ensure all required environment variables are configured

## Code Quality

The project enforces code quality through:

- **ESLint**: TypeScript, React, and custom rules (no relative imports, i18next)
- **Prettier**: Consistent code formatting with import sorting
- **Husky + lint-staged**: Pre-commit hooks for automatic linting and formatting
- **TypeScript**: Strict mode enabled

## License

MIT
