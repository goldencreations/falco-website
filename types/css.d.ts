// Ambient declaration for plain (non-module) CSS side-effect imports, e.g. `import './globals.css'`.
// Next.js's own type-defs only declare `*.module.css`, so editors that check side-effect
// imports strictly (`noUncheckedSideEffectImports`) can't otherwise resolve this import.
declare module "*.css";
