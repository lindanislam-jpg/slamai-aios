/**
 * Seeds the remittance module: reference data, the launch corridor, the €5 fee
 * rule, an admin and a clearly-labelled demo customer.
 *
 * Run with: npm run db:seed:remit
 * Safe to re-run — everything is upserted.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const ALL_PERMISSIONS = [
  "customers:view",
  "customers:suspend",
  "transfers:view",
  "compliance:review",
  "fees:manage",
  "corridors:manage",
  "audit:view",
];

async function main() {
  // --- Currencies ----------------------------------------------------------
  const currencies = [
    { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2 },
    { code: "ZAR", name: "South African Rand", symbol: "R", minorUnits: 2 },
    { code: "GBP", name: "Pound Sterling", symbol: "£", minorUnits: 2 },
    { code: "NGN", name: "Nigerian Naira", symbol: "₦", minorUnits: 2 },
    { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", minorUnits: 2 },
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh", minorUnits: 2 },
  ];
  for (const currency of currencies) {
    await db.remitCurrency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    });
  }

  // --- Countries -----------------------------------------------------------
  // `canSend` / `canReceive` gate which countries appear in the UI at all.
  // Only Ireland -> South Africa is enabled; the rest are here to show that
  // adding a corridor is data, not code.
  const countries = [
    { code: "IE", name: "Ireland", currencyCode: "EUR", flagEmoji: "🇮🇪", dialCode: "+353", riskBand: "LOW", canSend: true, canReceive: false },
    { code: "ZA", name: "South Africa", currencyCode: "ZAR", flagEmoji: "🇿🇦", dialCode: "+27", riskBand: "MEDIUM", canSend: false, canReceive: true },
    { code: "GB", name: "United Kingdom", currencyCode: "GBP", flagEmoji: "🇬🇧", dialCode: "+44", riskBand: "LOW", canSend: false, canReceive: false },
    { code: "NG", name: "Nigeria", currencyCode: "NGN", flagEmoji: "🇳🇬", dialCode: "+234", riskBand: "HIGH", canSend: false, canReceive: false },
    { code: "GH", name: "Ghana", currencyCode: "GHS", flagEmoji: "🇬🇭", dialCode: "+233", riskBand: "MEDIUM", canSend: false, canReceive: false },
    { code: "KE", name: "Kenya", currencyCode: "KES", flagEmoji: "🇰🇪", dialCode: "+254", riskBand: "MEDIUM", canSend: false, canReceive: false },
  ];
  for (const country of countries) {
    await db.remitCountry.upsert({
      where: { code: country.code },
      update: country,
      create: country,
    });
  }

  // --- Launch corridor: Ireland -> South Africa ----------------------------
  const corridor = await db.remitCorridor.upsert({
    where: { sourceCountryCode_destCountryCode: { sourceCountryCode: "IE", destCountryCode: "ZA" } },
    update: {},
    create: {
      sourceCountryCode: "IE",
      destCountryCode: "ZA",
      sourceCurrency: "EUR",
      destCurrency: "ZAR",
      isActive: true,
      minAmountMinor: 1_000n, // €10
      maxAmountMinor: 500_000n, // €5,000
      dailyLimitMinor: 500_000n, // €5,000 / 24h
      monthlyLimitMinor: 1_500_000n, // €15,000 / 30d
      // Zero FX margin: the customer gets the rate we get, and the €5 fee is
      // the only charge. See docs/remit/BUSINESS-MODEL.md — this is the honest
      // version of the proposition and it is also the loss-making one at low
      // volume. It is a business decision, changeable per corridor from admin.
      fxMarginBps: 0,
      estimatedMinMins: 60,
      estimatedMaxMins: 24 * 60,
      fxProviderKey: "sandbox",
      payoutProviderKey: "sandbox",
      isLive: false,
    },
  });

  await db.remitCorridorPaymentOption.upsert({
    where: { corridorId_method: { corridorId: corridor.id, method: "BANK_TRANSFER" } },
    update: { isEnabled: true },
    create: { corridorId: corridor.id, method: "BANK_TRANSFER", isEnabled: true, sortOrder: 0, providerKey: "sandbox" },
  });
  await db.remitCorridorPaymentOption.upsert({
    where: { corridorId_method: { corridorId: corridor.id, method: "DEBIT_CARD" } },
    update: {},
    // Disabled until a real card acquirer is connected. Shown in the UI as
    // "coming soon" rather than pretending it works.
    create: { corridorId: corridor.id, method: "DEBIT_CARD", isEnabled: false, sortOrder: 1, providerKey: "stripe" },
  });
  await db.remitCorridorPayoutOption.upsert({
    where: { corridorId_method: { corridorId: corridor.id, method: "BANK_DEPOSIT" } },
    update: { isEnabled: true },
    create: { corridorId: corridor.id, method: "BANK_DEPOSIT", isEnabled: true, sortOrder: 0, providerKey: "sandbox" },
  });

  // --- Fee rules -----------------------------------------------------------
  // The headline €5 fee lives here, not in code.
  const standardFee = await db.remitFeeRule.findFirst({ where: { name: "Standard €5 transfer fee" } });
  if (!standardFee) {
    await db.remitFeeRule.create({
      data: {
        name: "Standard €5 transfer fee",
        corridorId: null,
        currency: "EUR",
        fixedFeeMinor: 500n,
        percentageBps: 0,
        priority: 0,
        isActive: true,
      },
    });
  }

  const promoFee = await db.remitFeeRule.findFirst({ where: { name: "First transfer free (promo)" } });
  if (!promoFee) {
    await db.remitFeeRule.create({
      data: {
        name: "First transfer free (promo)",
        corridorId: null,
        promoCode: "FIRSTFREE",
        currency: "EUR",
        fixedFeeMinor: 0n,
        percentageBps: 0,
        priority: 100,
        // Inactive by default: a promo is switched on deliberately from admin.
        isActive: false,
      },
    });
  }

  // --- Admin ---------------------------------------------------------------
  const adminEmail = (process.env.REMIT_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.REMIT_ADMIN_PASSWORD || "AdminDemo123!";
  const adminUser = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Remit Admin",
      password: await bcrypt.hash(adminPassword, 12),
      role: "admin",
    },
  });
  await db.remitAdmin.upsert({
    where: { userId: adminUser.id },
    update: { permissions: ALL_PERMISSIONS },
    create: { userId: adminUser.id, permissions: ALL_PERMISSIONS },
  });

  // --- Demo customer -------------------------------------------------------
  // Flagged `isDemo`, so every transfer it creates is a sandbox transfer and
  // is labelled as such everywhere it appears.
  const demoEmail = (process.env.REMIT_DEMO_EMAIL || "demo@example.com").toLowerCase();
  const demoPassword = process.env.REMIT_DEMO_PASSWORD || "DemoSend123!";
  const demoUser = await db.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo Sender",
      password: await bcrypt.hash(demoPassword, 12),
    },
  });
  const demoCustomer = await db.remitCustomer.upsert({
    where: { userId: demoUser.id },
    update: { isDemo: true },
    create: {
      userId: demoUser.id,
      email: demoEmail,
      fullName: "Demo Sender",
      countryCode: "IE",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      kycStatus: "APPROVED",
      kycApprovedAt: new Date(),
      isDemo: true,
      city: "Dublin",
      addressLine1: "1 Sample Street",
      postalCode: "D01 X000",
    },
  });

  const existingRecipient = await db.remitRecipient.findFirst({
    where: { customerId: demoCustomer.id },
  });
  if (!existingRecipient) {
    await db.remitRecipient.create({
      data: {
        customerId: demoCustomer.id,
        nickname: "Mum",
        fullName: "Thandiwe Sample",
        destCountryCode: "ZA",
        destCurrency: "ZAR",
        payoutMethod: "BANK_DEPOSIT",
        details: {
          fullName: "Thandiwe Sample",
          bankCode: "CAPITEC",
          accountNumber: "1234567890",
          branchCode: "470010",
          accountType: "SAVINGS",
        },
      },
    });
  }

  console.log("Remittance seed complete.");
  console.log(`  Corridor : IE -> ZA (EUR -> ZAR), sandbox providers`);
  console.log(`  Admin    : ${adminEmail} / ${adminPassword}`);
  console.log(`  Demo     : ${demoEmail} / ${demoPassword}`);
  console.log("  No real money can move: every provider is a sandbox implementation.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
