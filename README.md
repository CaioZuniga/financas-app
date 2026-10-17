# Finanças

Controle de finanças pessoais em PWA: cartão de crédito (importando o PDF da fatura), financiamento imobiliário SAC + TR, dívidas e projeção de caixa de 12 meses.

Publicado em https://caiozuniga.github.io/financas-app/

- **Privado por padrão**: os PDFs são lidos no navegador (pdf.js) e os dados ficam no IndexedDB do aparelho. Backup em JSON na tela Ajustes.
- **Cartão**: importa faturas do Nubank, C6, Inter, XP e bancos com layout `DD/MM`; tela de revisão antes de salvar; categorias com regras aprendidas.
- **Imóvel**: tabela SAC com correção pela TR, seguros e taxa, simulação de amortização extra (reduzir prazo ou parcela).
- **Dívidas**: avalanche × bola de neve com orçamento ajustável.
- **Fluxo**: receitas e contas fixas com reajuste anual; projeção mês a mês somando tudo.

```bash
npm install
npm run dev
npm test
```
