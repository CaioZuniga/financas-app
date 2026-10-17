# financas-app

- Textos da interface em português do Brasil.
- Cores e fontes vêm só dos tokens em `src/index.css` (`@theme`). Visual "dark fintech": vidro, neon (`neon`) e violeta. Não use cores soltas nos componentes.
- O motor (`src/engine`) é só regras puras e cada regra tem teste em Vitest (`npm test`).
- Os dados ficam no IndexedDB do navegador (Dexie, `src/db.ts`). Nada é enviado para servidor.
- Parsers de fatura: `src/engine/pdf/parse.ts`. PDFs reais para calibrar ficam em `amostras/` (no .gitignore, nunca versionar). Ao calibrar um banco novo, transforme as linhas relevantes em teste com valores fictícios.
- Antes de commitar: `npm test`, `npm run lint` e `npm run build` passando.
