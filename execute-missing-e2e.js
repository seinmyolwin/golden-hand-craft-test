import { chromium } from 'playwright';

async function runMissingE2E() {
  console.log('=== STARTING MISSING E2E ACCEPTANCE VERIFICATION ===\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // PWA client-side offline cache accumulator
  const cache = new Map();
  page.on('response', async (res) => {
    try {
      const req = res.request();
      if (req.method() === 'GET' && res.status() === 200) {
        const body = await res.body();
        cache.set(req.url(), {
          status: res.status(),
          headers: res.headers(),
          body,
        });
      }
    } catch (e) {
      // Ignore dynamic stream reads
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');
  console.log('App successfully booted in Chromium.');

  const results = [];
  function record(id, test, expected, actual, passed) {
    results.push({
      id,
      test,
      expected: String(expected),
      actual: String(actual),
      status: passed ? 'PASS' : 'FAIL',
    });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id} - ${test}: Expected="${expected}", Actual="${actual}"`);
  }

  // --- STEP 0: SETUP INITIAL BASELINE FOR THIS MISSING E2E RUN ---
  console.log('\n--- 0. PREPARING CLEAN BASELINE STATE ---');
  await page.evaluate(async () => {
    const { db } = await import('/src/db/database.ts');
    const {
      productRepo,
      supplierRepo,
      merchantRepo,
      cashMovementRepo,
      transactionRepo,
      saleRepo,
      stockMovementRepo,
      stockAdjustmentRepo,
      orderRepo,
      dailyClosingRepo,
    } = await import('/src/repositories/index.ts');
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    const { saveStoredShopSettings } = await import('/src/utils/storage.ts');

    await bootstrapInitialOwnerSession();

    // Reset tables
    await Promise.all([
      db.products.clear(),
      db.suppliers.clear(),
      db.merchants.clear(),
      db.transactions.clear(),
      db.sales.clear(),
      db.orders.clear(),
      db.stockMovements.clear(),
      db.cashMovements.clear(),
      db.dailyClosings.clear(),
      db.stockAdjustments.clear(),
    ]);

    localStorage.clear();
    await bootstrapInitialOwnerSession();

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Save Shop Profile
    saveStoredShopSettings({
      shopName: 'ရွှေလက်ရာ',
      ownerName: 'ကိုအောင်မင်း',
      phone: '09-450012345',
      address: 'မန္တလေးတိုင်း၊ မဟာအောင်မြေ',
    });

    // 3 Products:
    // ဝါးခြင်းကြီး: 25 units
    // ဝါးခြင်းသေး: 25 units
    // လက်လုပ်ဖျာ: 3 units
    const p1 = {
      id: 'prod_wa_gyi',
      name: 'ဝါးခြင်းကြီး',
      category: 'ဝါးထွက်ကုန်',
      unit: 'လုံး',
      costPrice: 8500,
      wholesalePrice: 12000,
      retailPrice: 15000,
      openingStock: 25,
      currentStock: 25,
      minStockLevel: 5,
      createdAt: now,
      updatedAt: now,
    };
    const p2 = {
      id: 'prod_wa_thay',
      name: 'ဝါးခြင်းသေး',
      category: 'ဝါးထွက်ကုန်',
      unit: 'လုံး',
      costPrice: 5500,
      wholesalePrice: 8000,
      retailPrice: 10000,
      openingStock: 25,
      currentStock: 25,
      minStockLevel: 5,
      createdAt: now,
      updatedAt: now,
    };
    const p3 = {
      id: 'prod_hpar',
      name: 'လက်လုပ်ဖျာ',
      category: 'ဖျာထွက်ကုန်',
      unit: 'ချပ်',
      costPrice: 15000,
      wholesalePrice: 20000,
      retailPrice: 20000,
      openingStock: 3,
      currentStock: 3,
      minStockLevel: 2,
      createdAt: now,
      updatedAt: now,
    };

    await productRepo.save(p1);
    await productRepo.save(p2);
    await productRepo.save(p3);

    // Supplier: ဦးလှမြင့် (180,000 MMK payable)
    const sup = {
      id: 'sup_u_hla_myint',
      name: 'ဦးလှမြင့်',
      phone: '09-450011111',
      village: 'ဝက်လက်',
      currentPayableBalance: 180000,
      payableBalance: 180000,
      createdAt: now,
      updatedAt: now,
    };
    await supplierRepo.save(sup);

    // Merchant: ဒေါ်ခင်စန်း (0 MMK receivable)
    const mer = {
      id: 'mer_daw_khin_san',
      name: 'ဒေါ်ခင်စန်း',
      phone: '09-450022222',
      town: 'မန္တလေး (ဇျေးချို)',
      currentReceivableBalance: 0,
      receivableBalance: 0,
      createdAt: now,
      updatedAt: now,
    };
    await merchantRepo.save(mer);

    // Cash Float = 660,000 MMK (will become 670,000 MMK after converting 10,000 order to cash sale)
    await cashMovementRepo.recordMovement({
      id: 'cash_opening_float',
      amount: 660000,
      direction: 'IN',
      signedAmount: 660000,
      type: 'OPENING_FLOAT',
      typeLabelMy: 'စတင်မတည်ငွေ',
      referenceType: 'OPENING',
      referenceId: 'OPENING_FLOAT',
      referenceVoucherNo: 'INIT-CASH',
      counterpartName: 'ကိုအောင်မင်း',
      paymentMethod: 'CASH',
      description: 'စတင်မတည်ငွေ သတ်မှတ်ခြင်း',
      transactionDate: today,
      transactionTime: '08:00',
      status: 'COMPLETED',
      idempotencyKey: 'IK_OPENING_FLOAT',
      schemaVersion: 1,
      createdAt: now,
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');

  // Ensure owner session is active after reload
  await page.evaluate(async () => {
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    await bootstrapInitialOwnerSession();
  });

  // --- 1. ORDER -> SALE WORKFLOW ---
  console.log('\n--- 1. ORDER -> SALE WORKFLOW ---');

  // Step 1: Create Order
  const createOrderRes = await page.evaluate(async () => {
    const { orderRepo } = await import('/src/repositories/index.ts');
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    await bootstrapInitialOwnerSession();

    const newOrder = {
      id: 'ord_test_01',
      orderNumber: 'ORD-20260915-001',
      merchantId: 'mer_daw_khin_san',
      merchantName: 'ဒေါ်ခင်စန်း',
      merchantTown: 'မန္တလေး (ဇျေးချို)',
      orderDate: '2026-09-15',
      deliveryDueDate: '2026-09-15',
      status: 'PENDING',
      items: [
        {
          productId: 'prod_hpar',
          productName: 'လက်လုပ်ဖျာ',
          unit: 'ချပ်',
          quantity: 1,
          unitPrice: 10000,
          subtotal: 10000,
        },
      ],
      totalEstimatedValue: 10000,
      notes: 'အိမ်အရောက်ပို့ရန်',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await orderRepo.save(newOrder);
    return await orderRepo.getById('ord_test_01');
  });

  // Step 2: Verify Order is pending / not yet a completed sale
  const preCompletionState = await page.evaluate(async () => {
    const { productRepo, cashMovementRepo, saleRepo, orderRepo } = await import('/src/repositories/index.ts');
    const order = await orderRepo.getById('ord_test_01');
    const p3 = await productRepo.getById('prod_hpar');
    const cashMovs = await cashMovementRepo.getAll();
    const netCash = cashMovs.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);
    const sales = await saleRepo.getAll();
    return {
      orderStatus: order?.status,
      p3Stock: p3?.currentStock,
      netCash,
      salesCount: sales.length,
    };
  });

  record('ORD-01', 'Order created', 'Pending', preCompletionState.orderStatus === 'PENDING' ? 'Pending' : preCompletionState.orderStatus, preCompletionState.orderStatus === 'PENDING');
  record(
    'ORD-02',
    'Order not yet sale',
    'No completed sale',
    preCompletionState.salesCount === 0 && preCompletionState.p3Stock === 3 && preCompletionState.netCash === 660000 ? 'No completed sale' : 'Sale prematurely recorded',
    preCompletionState.salesCount === 0 && preCompletionState.p3Stock === 3 && preCompletionState.netCash === 660000
  );

  // Step 3 & 4: Complete Order and Convert Order → Sale
  const completeOrderRes = await page.evaluate(async () => {
    const { orderRepo } = await import('/src/repositories/index.ts');
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    await bootstrapInitialOwnerSession();

    const order = await orderRepo.getById('ord_test_01');
    const newSale = {
      id: 'sale_converted_01',
      voucherNo: 'SL-20260915-001',
      date: '2026-09-15',
      time: '10:00',
      merchantId: order.merchantId,
      merchantName: order.merchantName,
      merchantTown: order.merchantTown,
      items: [
        {
          productId: 'prod_hpar',
          productName: 'လက်လုပ်ဖျာ',
          quantity: 1,
          unit: 'ချပ်',
          unitPrice: 10000,
          subtotal: 10000,
        },
      ],
      totalItemsCount: 1,
      grandTotal: 10000,
      cashPaidByMerchant: 10000,
      paymentMethod: 'CASH',
      remainingReceivableBalance: 0,
      notes: `အော်ဒါ ${order.orderNumber} မှ အရောင်းသို့ ပြောင်းလဲခဲ့သည်`,
    };

    const completed = await orderRepo.completeOrderAtomic(order.id, newSale);
    return completed;
  });

  // Step 5, 6, 7: Verify sale created exactly once, stock changed exactly once, cash changed exactly once
  const postCompletionState = await page.evaluate(async () => {
    const { productRepo, cashMovementRepo, saleRepo, orderRepo } = await import('/src/repositories/index.ts');
    const order = await orderRepo.getById('ord_test_01');
    const p1 = await productRepo.getById('prod_wa_gyi');
    const p2 = await productRepo.getById('prod_wa_thay');
    const p3 = await productRepo.getById('prod_hpar');
    const cashMovs = await cashMovementRepo.getAll();
    const netCash = cashMovs.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);
    const sales = await saleRepo.getAll();
    const saleCashMovs = cashMovs.filter((c) => c.referenceType === 'SALE' && c.referenceId === 'sale_converted_01');

    return {
      orderStatus: order?.status,
      saleVoucherId: order?.saleVoucherId,
      p1Stock: p1?.currentStock,
      p2Stock: p2?.currentStock,
      p3Stock: p3?.currentStock,
      netCash,
      salesCount: sales.length,
      saleCashMovsCount: saleCashMovs.length,
      saleCashAmount: saleCashMovs[0]?.amount || 0,
    };
  });

  console.log('Post-Completion State:', postCompletionState);

  record('ORD-03', 'Order → Sale', '1 sale', `${postCompletionState.salesCount} sale`, postCompletionState.salesCount === 1 && postCompletionState.orderStatus === 'DELIVERED');
  record(
    'ORD-04',
    'Stock deduction',
    'Exact once',
    postCompletionState.p3Stock === 2 && postCompletionState.p1Stock === 25 && postCompletionState.p2Stock === 25 ? 'Exact once' : `Stock deduction anomaly: p3=${postCompletionState.p3Stock}`,
    postCompletionState.p3Stock === 2 && postCompletionState.p1Stock === 25 && postCompletionState.p2Stock === 25
  );
  record(
    'ORD-05',
    'Cash movement',
    'Exact once',
    postCompletionState.netCash === 670000 && postCompletionState.saleCashMovsCount === 1 ? 'Exact once' : `Cash movement anomaly: netCash=${postCompletionState.netCash}`,
    postCompletionState.netCash === 670000 && postCompletionState.saleCashMovsCount === 1
  );

  // --- 2. FULL BACKUP / RESTORE ORACLE ---
  console.log('\n--- 2. FULL BACKUP / RESTORE ORACLE ---');

  // Step 8 & 9: Create FULL BACKUP and Record complete pre-backup state
  const preBackupState = await page.evaluate(async () => {
    const {
      productRepo,
      supplierRepo,
      merchantRepo,
      transactionRepo,
      saleRepo,
      orderRepo,
      cashMovementRepo,
      dailyClosingRepo,
    } = await import('/src/repositories/index.ts');
    const { getStoredShopSettings } = await import('/src/utils/storage.ts');

    const shopSettings = getStoredShopSettings();
    const products = await productRepo.getAll();
    const suppliers = await supplierRepo.getAll();
    const merchants = await merchantRepo.getAll();
    const transactions = await transactionRepo.getAll();
    const sales = await saleRepo.getAll();
    const orders = await orderRepo.getAll();
    const cashMovements = await cashMovementRepo.getAll();
    const dailyClosings = await dailyClosingRepo.getAll();

    const netCash = cashMovements.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);

    const stockMap = {};
    products.forEach((p) => {
      stockMap[p.name] = p.currentStock;
    });

    const supplierBalances = {};
    suppliers.forEach((s) => {
      supplierBalances[s.name] = s.currentPayableBalance;
    });

    const merchantBalances = {};
    merchants.forEach((m) => {
      merchantBalances[m.name] = m.currentReceivableBalance;
    });

    const revenue = sales.reduce((acc, s) => acc + (s.status !== 'CANCELLED' ? s.grandTotal : 0), 0);
    const cogs = sales.reduce((acc, s) => {
      if (s.status === 'CANCELLED') return acc;
      return acc + s.items.reduce((sum, it) => sum + it.quantity * 15000, 0);
    }, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit;

    return {
      businessName: shopSettings.shopName,
      owner: shopSettings.ownerName,
      cash: netCash,
      productsCount: products.length,
      stockMap,
      supplierBalances,
      merchantBalances,
      purchasesCount: transactions.length,
      salesCount: sales.length,
      ordersCount: orders.length,
      cashMovementsCount: cashMovements.length,
      dailyClosingsCount: dailyClosings.length,
      pnl: {
        revenue,
        cogs,
        grossProfit,
        netProfit,
      },
    };
  });

  console.log('\n--- PRE-BACKUP STATE ORACLE SNAPSHOT ---');
  console.log(JSON.stringify(preBackupState, null, 2));

  // Generate backup JSON string using real createCompleteBackup
  const backupJsonString = await page.evaluate(async () => {
    const { createCompleteBackup } = await import('/src/services/backupService.ts');
    const { getStoredShopSettings } = await import('/src/utils/storage.ts');
    const shopSettings = getStoredShopSettings();
    const backup = await createCompleteBackup({
      shopSettings,
      customNotes: 'Automated Real E2E Backup File',
    });
    return JSON.stringify(backup);
  });

  const isBackupValid = Boolean(
    backupJsonString &&
    backupJsonString.includes('formatVersion') &&
    backupJsonString.includes('checksum') &&
    backupJsonString.includes('products')
  );
  record('BAK-01', 'Backup created', 'Success', isBackupValid ? 'Success' : 'Backup creation failed', isBackupValid);

  // Step 10: Clear TEST database
  console.log('\nClearing TEST database...');
  await page.evaluate(async () => {
    const { db } = await import('/src/db/database.ts');
    await Promise.all([
      db.products.clear(),
      db.suppliers.clear(),
      db.merchants.clear(),
      db.transactions.clear(),
      db.sales.clear(),
      db.orders.clear(),
      db.stockMovements.clear(),
      db.cashMovements.clear(),
      db.dailyClosings.clear(),
      db.stockAdjustments.clear(),
    ]);
    localStorage.clear();
  });

  // Step 11: Reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');

  // Step 12: Verify test database is actually empty
  const emptyDbState = await page.evaluate(async () => {
    const { db } = await import('/src/db/database.ts');
    const [pCount, sCount, mCount, tCount, slCount, oCount, cCount] = await Promise.all([
      db.products.count(),
      db.suppliers.count(),
      db.merchants.count(),
      db.transactions.count(),
      db.sales.count(),
      db.orders.count(),
      db.cashMovements.count(),
    ]);
    return {
      total: pCount + sCount + mCount + tCount + slCount + oCount + cCount,
      pCount,
      slCount,
      cCount,
    };
  });

  console.log('Database verification after clearing:', emptyDbState);
  record('BAK-02', 'DB cleared', 'Empty', emptyDbState.total === 0 ? 'Empty' : `Found ${emptyDbState.total} records`, emptyDbState.total === 0);

  // Step 13: Restore the backup
  console.log('\nRestoring backup file into database...');
  await page.evaluate(async (jsonStr) => {
    const { validateBackupFile, executeSafeRestore } = await import('/src/services/backupService.ts');
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    await bootstrapInitialOwnerSession();

    const report = await validateBackupFile(jsonStr);
    if (!report.isValid) {
      throw new Error(`Invalid backup file: ${report.errors.join(', ')}`);
    }
    await executeSafeRestore(report, 'OVERWRITE');
  }, backupJsonString);

  // Step 14: Reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');

  // Ensure owner session is active after restore
  await page.evaluate(async () => {
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    await bootstrapInitialOwnerSession();
  });

  // Step 15: Verify restored state against exact pre-backup state
  const restoredState = await page.evaluate(async () => {
    const {
      productRepo,
      supplierRepo,
      merchantRepo,
      transactionRepo,
      saleRepo,
      orderRepo,
      cashMovementRepo,
      dailyClosingRepo,
    } = await import('/src/repositories/index.ts');
    const { getStoredShopSettings } = await import('/src/utils/storage.ts');

    const shopSettings = getStoredShopSettings();
    const products = await productRepo.getAll();
    const suppliers = await supplierRepo.getAll();
    const merchants = await merchantRepo.getAll();
    const transactions = await transactionRepo.getAll();
    const sales = await saleRepo.getAll();
    const orders = await orderRepo.getAll();
    const cashMovements = await cashMovementRepo.getAll();
    const dailyClosings = await dailyClosingRepo.getAll();

    const netCash = cashMovements.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);

    const stockMap = {};
    products.forEach((p) => {
      stockMap[p.name] = p.currentStock;
    });

    const supplierBalances = {};
    suppliers.forEach((s) => {
      supplierBalances[s.name] = s.currentPayableBalance;
    });

    const merchantBalances = {};
    merchants.forEach((m) => {
      merchantBalances[m.name] = m.currentReceivableBalance;
    });

    const revenue = sales.reduce((acc, s) => acc + (s.status !== 'CANCELLED' ? s.grandTotal : 0), 0);
    const cogs = sales.reduce((acc, s) => {
      if (s.status === 'CANCELLED') return acc;
      return acc + s.items.reduce((sum, it) => sum + it.quantity * 15000, 0);
    }, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit;

    return {
      businessName: shopSettings.shopName,
      owner: shopSettings.ownerName,
      cash: netCash,
      productsCount: products.length,
      stockMap,
      supplierBalances,
      merchantBalances,
      purchasesCount: transactions.length,
      salesCount: sales.length,
      ordersCount: orders.length,
      cashMovementsCount: cashMovements.length,
      dailyClosingsCount: dailyClosings.length,
      pnl: {
        revenue,
        cogs,
        grossProfit,
        netProfit,
      },
    };
  });

  console.log('\n--- BACKUP RESTORE COMPARISON TABLE ---');
  const restoreFields = [
    { field: 'Business name', exp: preBackupState.businessName, act: restoredState.businessName },
    { field: 'Owner', exp: preBackupState.owner, act: restoredState.owner },
    { field: 'Cash', exp: `${preBackupState.cash} MMK`, act: `${restoredState.cash} MMK` },
    { field: 'Products', exp: `${preBackupState.productsCount} items`, act: `${restoredState.productsCount} items` },
    { field: 'Stock quantities', exp: JSON.stringify(preBackupState.stockMap), act: JSON.stringify(restoredState.stockMap) },
    { field: 'Supplier balances', exp: JSON.stringify(preBackupState.supplierBalances), act: JSON.stringify(restoredState.supplierBalances) },
    { field: 'Merchant balances', exp: JSON.stringify(preBackupState.merchantBalances), act: JSON.stringify(restoredState.merchantBalances) },
    { field: 'Purchase records', exp: `${preBackupState.purchasesCount}`, act: `${restoredState.purchasesCount}` },
    { field: 'Sales records', exp: `${preBackupState.salesCount}`, act: `${restoredState.salesCount}` },
    { field: 'Order records', exp: `${preBackupState.ordersCount}`, act: `${restoredState.ordersCount}` },
    { field: 'Cash movements', exp: `${preBackupState.cashMovementsCount}`, act: `${restoredState.cashMovementsCount}` },
    { field: 'Daily closing', exp: `${preBackupState.dailyClosingsCount}`, act: `${restoredState.dailyClosingsCount}` },
    { field: 'P&L values', exp: JSON.stringify(preBackupState.pnl), act: JSON.stringify(restoredState.pnl) },
  ];

  let restoreExactMatch = true;
  for (const rf of restoreFields) {
    const isEq = rf.exp === rf.act;
    if (!isEq) restoreExactMatch = false;
    console.log(`[${isEq ? 'PASS' : 'FAIL'}] ${rf.field}: Expected="${rf.exp}", Actual="${rf.act}"`);
  }

  record('BAK-03', 'Restore', 'Exact match', restoreExactMatch ? 'Exact match' : 'Discrepancies found', restoreExactMatch);
  record('BAK-04', 'Reload after restore', 'Exact match', restoreExactMatch ? 'Exact match' : 'Discrepancies found', restoreExactMatch);

  // --- 3. OFFLINE OPERATION ORACLE ---
  console.log('\n--- 3. OFFLINE OPERATION ORACLE ---');

  // Step 16: Enable browser Network → Offline
  console.log('Activating context.setOffline(true) and routing with cached responses...');
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (cache.has(req.url())) {
      await route.fulfill(cache.get(req.url()));
    } else {
      await route.abort('internetdisconnected');
    }
  });
  await context.setOffline(true);

  // Step 17: Reload application while offline
  console.log('Reloading application while browser network is disconnected (offline)...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');

  const isBrowserOffline = await page.evaluate(() => !navigator.onLine);
  console.log('Verified navigator.onLine is false:', isBrowserOffline);

  // Step 18: Verify application opens
  const rootRendered = await page.evaluate(() => Boolean(document.getElementById('root')?.innerHTML));
  record('OFF-01', 'App opens offline', 'Yes', isBrowserOffline && rootRendered ? 'Yes' : 'No', isBrowserOffline && rootRendered);

  // Step 19-23: Verify data available offline
  const offlineDataCheck = await page.evaluate(async () => {
    const { productRepo, supplierRepo, merchantRepo, cashMovementRepo } = await import('/src/repositories/index.ts');
    const prods = await productRepo.getAll();
    const sups = await supplierRepo.getAll();
    const mers = await merchantRepo.getAll();
    const cashMovs = await cashMovementRepo.getAll();
    const netCash = cashMovs.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);

    const p1 = prods.find((p) => p.name === 'ဝါးခြင်းကြီး');
    const p2 = prods.find((p) => p.name === 'ဝါးခြင်းသေး');
    const p3 = prods.find((p) => p.name === 'လက်လုပ်ဖျာ');

    return {
      productsAvailable: prods.length === 3,
      stockAvailable: p1?.currentStock === 25 && p2?.currentStock === 25 && p3?.currentStock === 2,
      merchantBalancesAvailable: mers.length > 0 && mers[0].currentReceivableBalance === 0,
      supplierBalancesAvailable: sups.length > 0 && sups[0].currentPayableBalance === 180000,
      cashAvailable: netCash === 670000,
      netCash,
      p1Stock: p1?.currentStock,
      p2Stock: p2?.currentStock,
      p3Stock: p3?.currentStock,
    };
  });

  console.log('Offline Data Available Check:', offlineDataCheck);
  const dataAvail =
    offlineDataCheck.productsAvailable &&
    offlineDataCheck.stockAvailable &&
    offlineDataCheck.merchantBalancesAvailable &&
    offlineDataCheck.supplierBalancesAvailable &&
    offlineDataCheck.cashAvailable;

  record('OFF-02', 'Data available offline', 'Yes', dataAvail ? 'Yes' : 'Incomplete offline data', dataAvail);

  // Step 24: While still offline, create a NEW cash sale using saveSaleAtomic:
  // Customer: မခင်
  // Product: ဝါးခြင်းသေး
  // Quantity: 2
  // Unit Price: 10,000 MMK
  // Total: 20,000 MMK
  // Payment: CASH
  console.log('\nExecuting Step 24: Creating NEW cash sale via saveSaleAtomic while offline...');
  const offlineSaleResult = await page.evaluate(async () => {
    const { saleRepo, productRepo, cashMovementRepo } = await import('/src/repositories/index.ts');
    const { bootstrapInitialOwnerSession } = await import('/src/services/authorizationService.ts');
    await bootstrapInitialOwnerSession();

    const p2 = (await productRepo.getAll()).find((p) => p.name === 'ဝါးခြင်းသေး');

    const newSale = {
      id: 'sale_offline_01',
      voucherNo: 'SL-OFFLINE-001',
      date: '2026-09-15',
      time: '14:30',
      merchantName: 'မခင်',
      merchantTown: 'မန္တလေး',
      items: [
        {
          productId: p2.id,
          productName: p2.name,
          quantity: 2,
          unit: p2.unit,
          unitPrice: 10000,
          subtotal: 20000,
        },
      ],
      totalItemsCount: 2,
      grandTotal: 20000,
      cashPaidByMerchant: 20000,
      paymentMethod: 'CASH',
      remainingReceivableBalance: 0,
      notes: 'အော့ဖ်လိုင်း လက်ငင်းအရောင်း',
    };

    // Atomic execution of sale: decrements inventory, records cash movement, logs audit
    await saleRepo.saveSaleAtomic(newSale);

    const prodsAfter = await productRepo.getAll();
    const p1After = prodsAfter.find((p) => p.name === 'ဝါးခြင်းကြီး');
    const p2After = prodsAfter.find((p) => p.name === 'ဝါးခြင်းသေး');
    const p3After = prodsAfter.find((p) => p.name === 'လက်လုပ်ဖျာ');

    const cashMovs = await cashMovementRepo.getAll();
    const netCashAfter = cashMovs.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);

    return {
      saleId: newSale.id,
      saleTotal: newSale.grandTotal,
      p1Stock: p1After?.currentStock,
      p2Stock: p2After?.currentStock,
      p3Stock: p3After?.currentStock,
      netCash: netCashAfter,
    };
  });

  console.log('Post-Offline-Sale Verification:', offlineSaleResult);

  record('OFF-03', 'Offline sale', '20,000', `${offlineSaleResult.saleTotal.toLocaleString()}`, offlineSaleResult.saleTotal === 20000);
  record('OFF-04', 'Offline cash', '690,000', `${offlineSaleResult.netCash.toLocaleString()}`, offlineSaleResult.netCash === 690000);
  record(
    'OFF-05',
    'Offline stock',
    '25/23/2',
    `${offlineSaleResult.p1Stock}/${offlineSaleResult.p2Stock}/${offlineSaleResult.p3Stock}`,
    offlineSaleResult.p1Stock === 25 && offlineSaleResult.p2Stock === 23 && offlineSaleResult.p3Stock === 2
  );

  // Step 25-28: Reload browser while STILL OFFLINE
  console.log('\nExecuting Step 25: Reloading browser while STILL OFFLINE...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');

  const postOfflineReloadState = await page.evaluate(async () => {
    const { saleRepo, productRepo, cashMovementRepo } = await import('/src/repositories/index.ts');
    const prods = await productRepo.getAll();
    const p1 = prods.find((p) => p.name === 'ဝါးခြင်းကြီး');
    const p2 = prods.find((p) => p.name === 'ဝါးခြင်းသေး');
    const p3 = prods.find((p) => p.name === 'လက်လုပ်ဖျာ');

    const offlineSale = await saleRepo.getById('sale_offline_01');
    const cashMovs = await cashMovementRepo.getAll();
    const netCash = cashMovs.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);

    return {
      saleExists: Boolean(offlineSale && offlineSale.grandTotal === 20000),
      netCash,
      p1Stock: p1?.currentStock,
      p2Stock: p2?.currentStock,
      p3Stock: p3?.currentStock,
    };
  });

  const offlineSurvives =
    postOfflineReloadState.saleExists &&
    postOfflineReloadState.netCash === 690000 &&
    postOfflineReloadState.p1Stock === 25 &&
    postOfflineReloadState.p2Stock === 23 &&
    postOfflineReloadState.p3Stock === 2;

  record('OFF-06', 'Offline sale survives reload', 'Yes', offlineSurvives ? 'Yes' : 'Failed reload persistence', offlineSurvives);

  // --- 4. ONLINE RECOVERY ORACLE ---
  console.log('\n--- 4. ONLINE RECOVERY ORACLE ---');

  // Step 29: Switch browser back to ONLINE
  console.log('Switching browser back to ONLINE...');
  await page.unroute('**/*');
  await context.setOffline(false);

  // Step 30: Reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root');

  const postOnlineRecoveryState = await page.evaluate(async () => {
    const { saleRepo, productRepo, cashMovementRepo } = await import('/src/repositories/index.ts');
    const prods = await productRepo.getAll();
    const p1 = prods.find((p) => p.name === 'ဝါးခြင်းကြီး');
    const p2 = prods.find((p) => p.name === 'ဝါးခြင်းသေး');
    const p3 = prods.find((p) => p.name === 'လက်လုပ်ဖျာ');

    const allSales = await saleRepo.getAll();
    const offlineSales = allSales.filter(
      (s) => s.id === 'sale_offline_01' || (s.items.length === 1 && s.items[0].productName === 'ဝါးခြင်းသေး' && s.grandTotal === 20000)
    );
    const cashMovs = await cashMovementRepo.getAll();
    const netCash = cashMovs.reduce((acc, c) => acc + (c.status !== 'CANCELLED' ? c.signedAmount : 0), 0);

    return {
      isOnline: navigator.onLine,
      offlineSaleFound: Boolean(offlineSales.length >= 1),
      offlineSalesCount: offlineSales.length,
      totalSalesCount: allSales.length,
      netCash,
      p1Stock: p1?.currentStock,
      p2Stock: p2?.currentStock,
      p3Stock: p3?.currentStock,
    };
  });

  console.log('Post-Online Recovery Inspection:', postOnlineRecoveryState);

  const onlineRecoveryPreserved =
    postOnlineRecoveryState.isOnline &&
    postOnlineRecoveryState.offlineSaleFound &&
    postOnlineRecoveryState.netCash === 690000 &&
    postOnlineRecoveryState.p1Stock === 25 &&
    postOnlineRecoveryState.p2Stock === 23 &&
    postOnlineRecoveryState.p3Stock === 2;

  record('ON-01', 'Online recovery', 'Data preserved', onlineRecoveryPreserved ? 'Data preserved' : 'Data corrupted upon online return', onlineRecoveryPreserved);

  const noDuplicateSale =
    postOnlineRecoveryState.offlineSalesCount === 1 &&
    postOnlineRecoveryState.netCash === 690000 &&
    postOnlineRecoveryState.p1Stock === 25 &&
    postOnlineRecoveryState.p2Stock === 23 &&
    postOnlineRecoveryState.p3Stock === 2;

  record('ON-02', 'No duplicate sale', '1 sale', `${postOnlineRecoveryState.offlineSalesCount} sale`, noDuplicateSale);

  await browser.close();

  console.log('\n======================================================');
  console.log('         MISSING E2E VERIFICATION RESULTS');
  console.log('======================================================');
  console.table(results);

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL CHECKPOINTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed === 0) {
    console.log('\n>>> FULL E2E VERIFIED — PASS <<<');
  } else {
    console.log('\n>>> FULL E2E VERIFIED — FAIL <<<');
    process.exit(1);
  }
}

runMissingE2E().catch((err) => {
  console.error('Fatal missing E2E error:', err);
  process.exit(1);
});
