# 🍻 Distribuidora Zap - Bot de Vendas via WhatsApp

O **Distribuidora Zap** é um sistema automatizado de vendas para WhatsApp, focado em distribuidoras de bebidas. Ele gerencia o fluxo completo desde a saudação, exibição de menu, controle de carrinho, cadastro de clientes, captura de endereço até a confirmação do pedido e baixa automática de estoque.

## 🚀 Funcionalidades Principais

- **Atendimento Automático:** Fluxo de conversação inteligente via WhatsApp (Baileys).
- **Menu Dinâmico:** Listagem de produtos por categorias com preços e códigos.
- **Gestão de Carrinho:** Adicionar itens, definir quantidades, ver resumo e remover itens.
- **Controle de Estoque:** Validação em tempo real e baixa automática após confirmação do pedido.
- **Logística & Entrega:** Captura automática de endereço para novos clientes e persistência de dados.
- **Painel Administrativo (WhatsApp):** Comandos exclusivos para o dono da distribuidora gerenciar entregas.
- **Integrações (MCP):** Sincronização automática com Google Sheets e BI (Business Intelligence) via Model Context Protocol.

## 🛠️ Tecnologias Utilizadas

- **Node.js & TypeScript:** Core do sistema.
- **Baileys:** Biblioteca para conexão com o protocolo do WhatsApp.
- **SQLite (Knex):** Banco de dados local para persistência de produtos, pedidos e sessões.
- **Google Sheets API:** Sincronização externa para controle de entregadores.
- **MCP (Model Context Protocol):** Interface para inteligência artificial e relatórios de BI.

## 📋 Comandos do Bot

### Para Clientes:
- `OI` / `MENU`: Inicia o atendimento e mostra o cardápio.
- `CARRINHO`: Mostra os itens adicionados e o total.
- `FINALIZAR`: Inicia o processo de fechamento de pedido e endereço.
- `[CÓDIGO]`: Digitar o número do produto (ex: `1`) inicia a adição ao carrinho.

### Para Administradores:
- `PEDIDOS`: Lista todos os pedidos pendentes de entrega.
- `ENTREGUE [ID]`: Marca um pedido como concluído e notifica o sistema.

## ⚙️ Instalação e Configuração

1. **Requisitos:** Node.js v18+, NPM.
2. **Clonar o repositório:**
   ```bash
   git clone <repo-url>
   cd distribuidora-zap
   ```
3. **Instalar dependências:**
   ```bash
   npm install
   ```
4. **Configurar variáveis de ambiente:**
   Crie um arquivo `.env` baseado no `.env.example`:
   ```env
   ADMIN_PHONE=55619XXXXXXXX@s.whatsapp.net
   SPREADSHEET_ID=sua_id_do_google_sheets
   ```
5. **Iniciar o Bot:**
   ```bash
   npm start
   ```

## 📊 Business Intelligence (BI)

O sistema conta com um `ReportService` integrado que permite:
- Visualizar faturamento total.
- Ranking de produtos mais vendidos.
- Alertas de estoque baixo (menos de 10 unidades).

---
*Desenvolvido para facilitar a logística e aumentar as vendas da Distribuidora Zap.*
