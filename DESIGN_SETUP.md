# HappiTime Design System Setup

Run these commands from the **monorepo root** (`HappiTime/`) to complete the design system installation.

## Step 1: Clean stale npm cache and install dependencies

```bash
# Remove the stale npm directory causing issues
rm -rf node_modules/.supabase-OLOiiB0B

# Install all dependencies (includes new Tailwind + shadcn deps)
npm install
```

## Step 2: Verify the web app builds

```bash
npm run build:web
```

## Step 3: Start the dev server

```bash
npm run dev:web
```

## What was changed

### New files created:
- `apps/web/postcss.config.mjs` — PostCSS config for Tailwind v4
- `apps/web/components.json` — shadcn/ui configuration
- `apps/web/src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `apps/web/src/components/ui/Badge.tsx` — Status badges
- `apps/web/src/components/ui/Label.tsx` — Form labels
- `apps/web/src/components/ui/Textarea.tsx` — Textarea input
- `apps/web/src/components/ui/Select.tsx` — Select dropdown
- `apps/web/src/components/ui/Separator.tsx` — Visual divider
- `apps/web/src/components/ui/Table.tsx` — Data table components
- `apps/web/src/components/ui/index.ts` — Barrel export

### Updated files:
- `apps/web/package.json` — Added: tailwindcss v4, @tailwindcss/postcss, postcss, autoprefixer, class-variance-authority, clsx, tailwind-merge, lucide-react
- `apps/web/src/app/globals.css` — Complete rewrite: Tailwind v4 with @theme tokens (brand colors, typography scale, spacing, shadows, radius)
- `apps/web/src/app/layout.tsx` — Added Inter font via next/font/google
- `apps/web/src/components/ui/Button.tsx` — Upgraded from passthrough to variant-based component (default, brand, secondary, ghost, destructive, outline, link)
- `apps/web/src/components/ui/Card.tsx` — Upgraded with Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter subcomponents
- `apps/web/src/components/ui/Input.tsx` — Upgraded with focus rings, transitions, disabled/readonly states

### Brand tokens (defined in globals.css @theme):
- **Primary:** `#C8965A` (warm copper/amber)
- **Dark surface:** `#1A1A1A`
- **Background:** `#FAFAF8` (warm white)
- **Font:** Inter (via next/font/google)
- **Radius:** 6px (sm), 10px (md), 16px (lg)

### Backward compatibility:
The legacy CSS classes (`.container`, `.card`, `.row`, `.col`, `.muted`) are preserved in a Tailwind `@layer components` block. Existing pages will continue to work. Migrate them to Tailwind utilities one page at a time.

## Next steps

After verifying the build:
1. Add more shadcn/ui components as needed: `npx shadcn@latest add dialog sheet dropdown-menu tabs toast`
2. Start migrating pages to use the new components (dashboard first)
3. Replace CSS module files with Tailwind classes as you redesign each page
