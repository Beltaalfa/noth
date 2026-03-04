# Como testar o fluxo Helpdesk (POP 001/25)

Fluxo: **Cadastro e aprovação de desconto comercial** com 4 níveis (Crédito → Gerência → Diretor → Diretoria) e validações por forma de pagamento e volume.

---

## 1. Preparar ambiente

### Banco e seed

```bash
cd /var/www/north/hub
# Garantir migrações
npm run db:push   # ou db:migrate

# Criar setores e configs de aprovação para o cliente Rede PMG
npx tsx scripts/seed-helpdesk-aprovacao-pop.ts
```

### Subir o Hub

```bash
npm run dev
# ou: npm run dev:3010
```

Acesse no navegador (ex.: `http://localhost:3000` ou `http://localhost:3010`).

---

## 2. Onde testar na interface

- **Abrir chamado (solicitante):**  
  - Portal: **Helpdesk → Meus chamados** (`/helpdesk/meus-chamados`)  
  - Ou admin: **Helpdesk** (`/admin/helpdesk`)  
  Escolha o cliente **Rede PMG** e crie um novo chamado.

- **Aprovar:**  
  Quem for aprovador (ex.: usuário admin usado no seed) vê o ticket em “Aguardando aprovação” e pode aprovar em **Meus chamados** ou na tela de detalhe do ticket (botão Aprovar).

---

## 3. Criar um chamado de teste

1. **Tipo de solicitação:**  
   Selecione **"Cadastro e aprovação de desconto comercial"**.

2. **Valor do desconto (R$):**  
   Use um valor em **reais** que corresponda ao nível que quer testar:
   - **Nível 1 (Crédito):** até **R$ 0,05** (5 centavos)
   - **Nível 2 (Gerência):** até **R$ 0,10** (10 centavos)
   - **Nível 3 (Diretor):** até **R$ 0,15** (15 centavos)
   - **Nível 4 (Diretoria):** acima de **R$ 0,15**

3. **Dados para cadastro e desconto comercial:**
   - **Forma de pagamento:** vinda da API (tab do cliente). Para **nível 1** precisa ser **à vista** (ex.: **DINHEIRO** ou **PIX**).
   - **Volume estimado (L):** para nível 1 precisa ser **≥ 500**.
   - **Classe ABC:** para nível 2 precisa ser **A** ou **B**.

4. Salve/abra o chamado. O sistema encaminha para o primeiro setor (Análise de Crédito) e o ticket fica **aguardando aprovação**.

---

## 4. Cenários de validação (aprovação)

### Nível 1 – Análise de Crédito (desconto ≤ 5¢)

- **Forma de pagamento** deve ser à vista: **DINHEIRO** ou **PIX** (nome em maiúsculas).
- **Volume estimado** deve ser **≥ 500 L**.

Se tentar aprovar no nível 1 **sem** forma à vista ou com volume &lt; 500, a API retorna **400** com mensagem:
- *"Aprovação neste nível exige forma de pagamento à vista (ex.: Dinheiro, PIX)."*
- *"Aprovação neste nível exige volume estimado de pelo menos 500 L."*

**Teste sugerido:**  
Chamado com R$ 0,05, forma **PIX**, volume **600 L** → aprovar como Crédito → deve concluir (status concluído).

---

### Nível 2 – Gerência Comercial (desconto ≤ 10¢)

- **Classe ABC** deve ser **A** ou **B**.

Se a classe não for A nem B, ao aprovar no nível 2 a API retorna **400**:  
*"Aprovação neste nível exige classe ABC A ou B."*

**Teste sugerido:**  
Chamado com R$ 0,10, classe **A** (ou **B**) → aprovar como Crédito (passa) → depois aprovar como Gerência → deve concluir.

---

### Níveis 3 e 4 (Diretor / Diretoria)

- **Diretor:** desconto ≤ 15¢; após aprovação de Gerência, o ticket sobe para o setor **Diretor**.
- **Diretoria:** desconto &gt; 15¢; após Diretor, sobe para **Diretoria**.

Não há bloqueio extra por forma de pagamento ou volume nestes níveis. Basta aprovar em sequência (Crédito → Gerência → Diretor → Diretoria quando aplicável).

---

## 5. API de formas de pagamento (opcional)

Para conferir se o combo “Forma de pagamento” está sendo alimentado:

```http
GET /api/tools/negociacoes/formas-pagamento?clientId=<ID_DO_CLIENTE_REDE_PMG>
```

Requer autenticação e permissão de Negociações para o cliente. O ID do cliente Rede PMG pode ser obtido no admin (Config → Clientes) ou no banco (`Client` onde `name = 'Rede PMG'`).

---

## 6. Resumo rápido

| Passo | Ação |
|-------|------|
| 1 | `npx tsx scripts/seed-helpdesk-aprovacao-pop.ts` |
| 2 | `npm run dev` e acessar o Hub |
| 3 | Login com usuário que tenha Helpdesk para Rede PMG |
| 4 | Criar chamado tipo “Cadastro e aprovação de desconto comercial” com valor e campos (forma, volume, classe) conforme o nível |
| 5 | Aprovar com o usuário admin (ou aprovador configurado no seed) e verificar mensagens de erro (400) ou conclusão conforme as regras acima |

Se o cliente Rede PMG não tiver **formas de pagamento** cadastradas no banco (tab do PDV), o select pode vir vazio; mesmo assim é possível testar validações enviando no `formData` os nomes esperados (ex.: `formaPagamentoNome: "PIX"`, `volumeEstimadoLitros: 600`, `classeABC: "A"`).
