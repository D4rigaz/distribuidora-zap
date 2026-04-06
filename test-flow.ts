import { ProductService } from './src/services/productService.js';
import { CustomerService } from './src/services/customerService.js';
import { OrderService } from './src/services/orderService.js';
import { SessionService } from './src/services/sessionService.js';
import { ReportService } from './src/services/reportService.js';

async function runLocalTest() {
    const from = '5561999999999@s.whatsapp.net';
    const name = 'Cliente Simulado';

    console.log(`🚀 Iniciando Simulação de Teste para: ${name}\n`);

    // 1. Simular Saudação
    console.log("--- PASSO 1: SAUDAÇÃO ---");
    let session = await SessionService.getOrCreate(from);
    await CustomerService.sync(from, name);
    console.log(`Bot: Olá, ${name}! Bem-vindo à Distribuidora Zap. Digite MENU...`);

    // 2. Ver Menu
    console.log("\n--- PASSO 2: VER MENU ---");
    const products = await ProductService.getAvailableProducts();
    console.log(`Bot enviaria cardápio com ${products.length} itens.`);

    // 3. Adicionar Produto (Skol ID 1)
    console.log("\n--- PASSO 3: ADICIONAR PRODUTO (ID 1) ---");
    const p1 = await ProductService.getById(1);
    console.log(`Usuário escolheu: ${p1?.name}`);
    session.step = 'awaiting_quantity';
    session.lastProductId = 1;
    await SessionService.save(session);

    // 4. Definir Quantidade (3 unidades)
    console.log("\n--- PASSO 4: DEFINIR QUANTIDADE (3) ---");
    const quantity = 3;
    session.cart.push({
        id: p1!.id,
        name: p1!.name,
        price: p1!.price,
        quantity: quantity
    });
    session.step = 'idle';
    await SessionService.save(session);
    console.log(`Carrinho atual: ${session.cart.length} item(s)`);

    // 5. Finalizar e Pedir Endereço
    console.log("\n--- PASSO 5: FINALIZAR PEDIDO ---");
    const customer = await CustomerService.getByPhone(from);
    if (!customer?.address) {
        console.log("Bot: Ops! Não temos seu endereço. Digite seu endereço...");
        await CustomerService.updateAddress(from, "Rua de Teste, 456, Bairro Digital");
        console.log("Usuário enviou: Rua de Teste, 456, Bairro Digital");
    }

    // 6. Confirmação Final
    console.log("\n--- PASSO 6: CONFIRMAÇÃO FINAL (SIM) ---");
    const total = session.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const orderId = await OrderService.create(from, session.cart, total);
    console.log(`✅ PEDIDO #${orderId} CRIADO COM SUCESSO!`);
    console.log(`Total: R$ ${total.toFixed(2)}`);

    // 7. Verificar BI após o teste
    console.log("\n--- PASSO 7: VERIFICANDO RELATÓRIO DE BI ---");
    const revenue = await ReportService.getTotalRevenue();
    const top = await ReportService.getTopProducts(1);
    console.log(`💰 Faturamento Atual: R$ ${Number(revenue).toFixed(2)}`);
    console.log(`🔥 Produto mais vendido: ${top[0]?.name} (${top[0]?.quantity} un)`);

    process.exit(0);
}

runLocalTest().catch(console.error);
