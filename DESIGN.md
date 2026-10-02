---
version: alpha
name: IPA Financeiro
description: Painel operacional para solicitações, aprovações e pagamentos.
colors:
  canvas: "#080808"
  surface: "#0C0C0C"
  surface-hover: "#151515"
  border: "#1A1A1A"
  text-primary: "#F5F5F5"
  text-secondary: "#A3A3A3"
  text-muted: "#666666"
  primary: "#3B82F6"
  primary-hover: "#2563EB"
  success: "#34D399"
  error: "#EF4444"
typography:
  page-title: { fontFamily: Inter, system-ui, sans-serif, fontSize: 20px, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.02em }
  section-title: { fontFamily: Inter, system-ui, sans-serif, fontSize: 16px, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.01em }
  body-md: { fontFamily: Inter, system-ui, sans-serif, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontFamily: Inter, system-ui, sans-serif, fontSize: 12px, fontWeight: 400, lineHeight: 1.4 }
  label: { fontFamily: Inter, system-ui, sans-serif, fontSize: 12px, fontWeight: 600, lineHeight: 1.3 }
  data: { fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace, fontSize: 12px, fontWeight: 500, lineHeight: 1.4 }
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 10px
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# IPA Financeiro

## Overview

Uma interface operacional para equipes de IPA e financeiro acompanharem solicitações de exames, confirmações e pagamentos. A linguagem é sóbria, escura e compacta para favorecer leitura de dados e ações frequentes.

## Colors

- **Canvas:** preto suave para toda a aplicação, sem inversões de tema entre abas.
- **Primary:** azul usado para navegação ativa e ações principais.
- **Success e error:** reservados exclusivamente para estados financeiros concluídos ou cancelados.

## Typography

O texto segue uma escala pequena e legível. Valores, códigos e contagens usam fonte monoespaçada quando a comparação visual importa.

## Layout

- Conteúdo contido em 1400px, com barra lateral recolhível.
- Em telas menores, grids de dados se tornam uma coluna e tabelas preservam rolagem horizontal.
- Espaçamento padrão de 16px e painéis de 24px.

## Elevation & Depth

Hierarquia é criada por superfícies tonais e bordas finas. Sombras são discretas e usadas apenas em painéis sobrepostos e notificações.

## Shapes

Inputs e botões usam 8px. Painéis usam 12px. Estados compactos podem usar cantos totalmente arredondados.

## Components

- Botões primários acionam mudanças importantes e mantêm contraste alto.
- Tabelas usam cabeçalhos visíveis, linhas selecionáveis e estados vazios claros.
- Formulários informam campos inválidos na própria tela.
- Painéis laterais concentram criação e edição para manter o contexto da aba.

## Do's and Don'ts

- Use azul somente para ações e estado de navegação.
- Use ícones junto a ações que tenham impacto operacional.
- Preserve foco visível e rótulos associados aos campos.
- Não use cores decorativas, gradientes ou animações contínuas.
- Não esconda erros de formulário nem deixe botões sem ação.
