# Plano: Multi-empresa no cadastro/desconto

## Resumo

- **Negociações separadas:** um box por empresa; cada box tem seus produtos, tipos e grid (preço bomba daquela empresa).
- **Mesma negociação:** usuário marca mais de uma empresa; sistema valida se preço de bomba é igual para os itens em todas as empresas. Se igual → libera um grid único. Se diferente → popup com erro e valor em cada unidade (ex.: "Gasolina Comum — Posto A: R$ 5,00; Posto B: R$ 5,20").

## Validação preço bomba (mesma negociação)

- Chamar `GET preco-bomba?clientId=&codEmpresa=X` para cada empresa X.
- Comparar por `cod_item`: se algum item tiver valores diferentes entre empresas, mostrar modal com título "Preço de bomba diferente" e lista por item com valor por empresa.
- Só permitir preencher grid quando todos os itens tiverem mesmo valor em todas as empresas.

## Estado

- **Separadas:** `negociacoesPorEmpresa: Record<codEmpresa, { combustiveisSelecionados, tiposPorProduto, gridDescontos, precosBomba }>`.
- **Mesma:** `empresasMesmaNegociacao: number[]`, um único conjunto de produtos/tipos/grid; `precosBomba` preenchido após validação (valores iguais).

## Arquivos

- HelpdeskPage.tsx e MeusChamadosPage.tsx: UI de múltiplas empresas, boxes, opção "mesma negociação", validação e popup.
- helpdesk.ts: payload com lista de negociações e/ou codEmpresas para mesma negociação.
