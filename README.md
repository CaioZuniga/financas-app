# Finanças

Controle de finanças pessoais em PWA: cartão de crédito (importando o PDF da fatura), financiamento imobiliário SAC + TR, dívidas e projeção de caixa de 12 meses.

Publicado em https://caiozuniga.github.io/financas-app/

- **Privado por padrão**: os PDFs são lidos no navegador (pdf.js) e os dados ficam no IndexedDB do aparelho. Backup em JSON na tela Ajustes.
- **Cartão**: importa faturas do Nubank, C6, Inter, XP e bancos com layout `DD/MM`; tela de revisão antes de salvar; categorias com regras aprendidas.
- **Imóvel**: tabela SAC com correção pela TR, seguros e taxa, simulação de amortização extra (reduzir prazo ou parcela).
- **Conta corrente**: importa o PDF do extrato (Pix, boletos, débitos); pagamento de fatura não conta duas vezes.
- **Metas**: limite mensal por categoria somando cartão e conta, com alerta pelo ritmo do mês e sugestão pela média.
- **Patrimônio**: ativos (conta, investimentos, imóveis, veículos) − imóvel financiado − dívidas, com histórico mensal e projeção de 12 meses.
- **Dívidas**: avalanche × bola de neve com orçamento ajustável.
- **Fluxo**: receitas e contas fixas com reajuste anual; projeção mês a mês somando tudo.
- **Análises**: assinaturas e gastos recorrentes, gastos fora do padrão, mapa de calor mês × categoria, ranking de estabelecimentos e dia da semana, comprometimento de renda, reserva de emergência, independência financeira (regra dos 4%) e alívio de caixa quando as parcelas terminam.
- **Relatório mensal**: resumo do mês (entradas, gastos por categoria vs. mês anterior, metas, patrimônio, maiores gastos) pronto para imprimir ou salvar em PDF A4.
- **Sincronização**: backup criptografado (AES-GCM, chave derivada da sua senha) na pasta oculta do app no Google Drive, para usar no PC e no celular. Exige um Client ID OAuth do Google (instruções na tela Ajustes).

```bash
npm install
npm run dev
npm test
```
