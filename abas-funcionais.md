# Abas funcionais do IPA Financeiro

## Goal

Tornar Dashboard, Setor IPA, Financeiro, Relatórios e Configurações utilizáveis com um fluxo coerente de solicitações e persistência local.

## Tasks

- [x] Mapear a navegação, dados e ações já existentes. Verify: as cinco abas e suas lacunas foram identificadas no código.
- [ ] Criar tipos, dados iniciais e estado persistente. Verify: solicitação criada, alterada ou removida permanece após recarregar a página.
- [ ] Implementar Dashboard e Setor IPA. Verify: criar, pesquisar, filtrar, abrir detalhes e enviar rascunhos ao financeiro.
- [ ] Implementar Financeiro. Verify: filtrar solicitações, salvar status de pagamento e associar comprovante.
- [ ] Implementar Relatórios e Configurações. Verify: exportar CSV, atualizar preferências e restaurar dados de exemplo.
- [ ] Validar build, lint e fluxos principais. Verify: `npm run lint` e `npm run build` terminam sem erro.

## Done When

- [ ] Todas as abas exibem conteúdo próprio e têm ações funcionais.
- [ ] Os dados são consistentes entre Dashboard, IPA, Financeiro e Relatórios.
- [ ] Preferências e solicitações são persistidas localmente no navegador.
