import { randomBytes, randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import {
  createCommerceStore,
  createInMemoryCommerceStore,
  type CommerceStore,
  type LoyaltyProfile,
  type Order,
  type VoucherWalletEntry,
} from '../services/commerceStore.js';
import {
  buildSignedQrToken,
  buildUnsignedToken,
  getSessionContext,
  isPosAuthorized,
  normalizeEmail,
  normalizeUnitPriceRon,
  parseSignedOrUnsignedToken,
  POINTS_PER_RON,
  VOUCHER_EXPIRING_SOON_MS,
} from './utils.js';

type LoyaltyRoutesOptions = {
  store?: CommerceStore;
  firestore?: Firestore | null;
  loyaltySigningKey?: string;
  posScanApiKeys?: string[];
};

const resolveLoyaltySummary = (profile: LoyaltyProfile, orders: Order[]) => {
  const earnedPointsFromScans = Math.max(0, Math.floor(profile.earnedPointsFromScans ?? 0));
  const earnedPoints = Math.max(
    0,
    Math.floor(
      orders
        .filter(
          (order) =>
            order.status === 'created' ||
            order.status === 'confirmed' ||
            order.status === 'preparing' ||
            order.status === 'shipped' ||
            order.status === 'in_transit',
        )
        .reduce((sum, order) => sum + order.totalRon, 0) *
        POINTS_PER_RON +
        earnedPointsFromScans,
    ),
  );
  const points = Math.max(0, earnedPoints - profile.redeemedPoints);
  const tier = points >= 5000 ? 'Gold' : points >= 1500 ? 'Silver' : 'Bronze';
  const nextTierSpendRon = tier === 'Gold' ? 0 : tier === 'Silver' ? 5000 - points : 1500 - points;
  return { points, tier, nextTierSpendRon };
};

const normalizeVoucherWallet = (profile: LoyaltyProfile, nowMs = Date.now()) => {
  const redeemedCodes = new Set(profile.redeemedVoucherCodes ?? []);
  const walletMap = new Map<string, VoucherWalletEntry>();

  (profile.voucherHistory ?? []).forEach((entry) => {
    if (!entry || typeof entry.code !== 'string' || entry.code.trim().length === 0) return;
    walletMap.set(entry.code, { ...entry, code: entry.code.trim(), status: entry.status });
  });

  if (profile.lastVoucherCode && !walletMap.has(profile.lastVoucherCode)) {
    walletMap.set(profile.lastVoucherCode, {
      code: profile.lastVoucherCode,
      valueRon: profile.lastVoucherValueRon ?? 0,
      createdAt: profile.lastVoucherCreatedAt ?? new Date(nowMs).toISOString(),
      expiresAt:
        profile.lastVoucherExpiresAt ?? new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    });
  }

  const normalizedItems = Array.from(walletMap.values())
    .map((entry) => {
      const expiresMs = Number.isFinite(Date.parse(entry.expiresAt))
        ? Date.parse(entry.expiresAt)
        : 0;
      const isExpired = expiresMs > 0 && nowMs > expiresMs;
      const isUsed = entry.status === 'used' || redeemedCodes.has(entry.code);
      const status: VoucherWalletEntry['status'] = isUsed
        ? 'used'
        : isExpired
          ? 'expired'
          : 'active';
      return { ...entry, status };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const changed = JSON.stringify(normalizedItems) !== JSON.stringify(profile.voucherHistory ?? []);
  const active = normalizedItems.filter((item) => item.status === 'active');
  const used = normalizedItems.filter((item) => item.status === 'used');
  const expired = normalizedItems.filter((item) => item.status === 'expired');
  const expiringSoon = active.filter((item) => {
    const expiresMs = Date.parse(item.expiresAt);
    return Number.isFinite(expiresMs) && expiresMs - nowMs <= VOUCHER_EXPIRING_SOON_MS;
  });

  return { items: normalizedItems, active, used, expired, expiringSoon, changed };
};

const addNotificationWithPush = async (
  store: CommerceStore,
  userId: string,
  title: string,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _data?: Record<string, string>,
) => {
  const current = await store.getNotifications(userId);
  current.unshift({
    id: randomUUID(),
    userId,
    title,
    message,
    createdAt: new Date().toISOString(),
  });
  await store.setNotifications(userId, current.slice(0, 100));
  return current.length;
};

export const loyaltyRoutes: FastifyPluginAsync<LoyaltyRoutesOptions> = async (fastify, options) => {
  const store = options.store ?? (options.firestore ? createCommerceStore(options.firestore) : createInMemoryCommerceStore());

  fastify.get('/loyalty/summary', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const profile = await store.getLoyaltyProfile(sessionCtx.user.id);
    const wallet = normalizeVoucherWallet(profile);
    const normalizedProfile = wallet.changed
      ? { ...profile, voucherHistory: wallet.items }
      : profile;
    if (wallet.changed) {
      await store.setLoyaltyProfile(sessionCtx.user.id, normalizedProfile);
    }
    const orders = await store.getOrders(sessionCtx.user.id);
    return {
      ...resolveLoyaltySummary(normalizedProfile, orders),
      voucherWallet: {
        active: wallet.active,
        expiringSoon: wallet.expiringSoon,
        used: wallet.used,
        expired: wallet.expired,
      },
      ...(normalizedProfile.lastVoucherCode
        ? {
            lastVoucher: {
              code: normalizedProfile.lastVoucherCode,
              valueRon: normalizedProfile.lastVoucherValueRon ?? 0,
              createdAt: normalizedProfile.lastVoucherCreatedAt,
              expiresAt: normalizedProfile.lastVoucherExpiresAt,
              qrToken: normalizedProfile.lastVoucherQrToken,
            },
          }
        : {}),
      ...(normalizedProfile.loyaltyQrToken
        ? {
            loyaltyQrToken: normalizedProfile.loyaltyQrToken,
            loyaltyQrCreatedAt: normalizedProfile.loyaltyQrCreatedAt,
          }
        : {}),
    };
  });

  fastify.post('/loyalty/redeem', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const body = (request.body ?? {}) as { points?: number };
    const requestedPoints = Number(body.points ?? 100);
    const pointsToRedeem = Math.max(100, Math.trunc(requestedPoints));

    if (!Number.isFinite(pointsToRedeem) || pointsToRedeem % 100 !== 0) {
      reply.code(400);
      return { error: 'Points must be a positive multiple of 100.' };
    }

    const profile = await store.getLoyaltyProfile(sessionCtx.user.id);
    const orders = await store.getOrders(sessionCtx.user.id);
    const summary = resolveLoyaltySummary(profile, orders);

    if (summary.points < pointsToRedeem) {
      reply.code(400);
      return { error: 'Insufficient loyalty points.' };
    }

    const valueRon = Math.floor(pointsToRedeem / 100) * 5;
    const code = `DACUS-${randomBytes(4).toString('hex').toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const voucherPayload = {
      type: 'voucher',
      sub: sessionCtx.user.id,
      email: sessionCtx.user.email,
      code,
      valueRon,
      createdAt,
      expiresAt,
    };
    const voucherQrToken = options.loyaltySigningKey
      ? buildSignedQrToken(options.loyaltySigningKey, voucherPayload)
      : buildUnsignedToken(voucherPayload);

    const wallet = normalizeVoucherWallet(profile);
    const nextVoucherHistory: VoucherWalletEntry[] = [
      { code, valueRon, createdAt, expiresAt, status: 'active' as const },
      ...wallet.items.filter((item) => item.code !== code),
    ].slice(0, 120);

    const nextProfile: LoyaltyProfile = {
      ...profile,
      redeemedPoints: profile.redeemedPoints + pointsToRedeem,
      voucherHistory: nextVoucherHistory,
      lastVoucherCode: code,
      lastVoucherValueRon: valueRon,
      lastVoucherCreatedAt: createdAt,
      lastVoucherExpiresAt: expiresAt,
      lastVoucherQrToken: voucherQrToken,
    };
    await store.setLoyaltyProfile(sessionCtx.user.id, nextProfile);
    await addNotificationWithPush(
      store,
      sessionCtx.user.id,
      'Voucher fidelitate generat',
      `Voucher ${code} în valoare de ${valueRon} RON a fost creat și expiră la ${new Date(expiresAt).toLocaleDateString('ro-RO')}.`,
      { voucherCode: code },
    );

    return {
      voucher: {
        code,
        valueRon,
        pointsRedeemed: pointsToRedeem,
        createdAt,
        expiresAt,
        qrToken: voucherQrToken,
      },
      summary: {
        ...resolveLoyaltySummary(nextProfile, orders),
        lastVoucher: { code, valueRon, createdAt, expiresAt, qrToken: voucherQrToken },
        ...(nextProfile.loyaltyQrToken
          ? {
              loyaltyQrToken: nextProfile.loyaltyQrToken,
              loyaltyQrCreatedAt: nextProfile.loyaltyQrCreatedAt,
            }
          : {}),
      },
    };
  });

  fastify.post('/loyalty/qr', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const profile = await store.getLoyaltyProfile(sessionCtx.user.id);
    const orders = await store.getOrders(sessionCtx.user.id);
    const summary = resolveLoyaltySummary(profile, orders);

    if (profile.loyaltyQrToken) {
      return {
        qrToken: profile.loyaltyQrToken,
        issuedAt: profile.loyaltyQrCreatedAt ?? new Date().toISOString(),
        summary: {
          ...summary,
          ...(profile.lastVoucherCode
            ? {
                lastVoucher: {
                  code: profile.lastVoucherCode,
                  valueRon: profile.lastVoucherValueRon ?? 0,
                  createdAt: profile.lastVoucherCreatedAt,
                  expiresAt: profile.lastVoucherExpiresAt,
                  qrToken: profile.lastVoucherQrToken,
                },
              }
            : {}),
          loyaltyQrToken: profile.loyaltyQrToken,
          loyaltyQrCreatedAt: profile.loyaltyQrCreatedAt,
        },
      };
    }

    const issuedAt = new Date().toISOString();
    const payload = {
      type: 'loyalty-member',
      sub: sessionCtx.user.id,
      email: sessionCtx.user.email,
      points: summary.points,
      issuedAt,
      nonce: randomBytes(8).toString('hex'),
    };
    const qrToken = options.loyaltySigningKey
      ? buildSignedQrToken(options.loyaltySigningKey, payload)
      : buildUnsignedToken(payload);

    const nextProfile: LoyaltyProfile = {
      ...profile,
      loyaltyQrToken: qrToken,
      loyaltyQrCreatedAt: issuedAt,
    };
    await store.setLoyaltyProfile(sessionCtx.user.id, nextProfile);

    return {
      qrToken,
      issuedAt,
      summary: {
        ...summary,
        ...(nextProfile.lastVoucherCode
          ? {
              lastVoucher: {
                code: nextProfile.lastVoucherCode,
                valueRon: nextProfile.lastVoucherValueRon ?? 0,
                createdAt: nextProfile.lastVoucherCreatedAt,
                expiresAt: nextProfile.lastVoucherExpiresAt,
                qrToken: nextProfile.lastVoucherQrToken,
              },
            }
          : {}),
        loyaltyQrToken: qrToken,
        loyaltyQrCreatedAt: issuedAt,
      },
    };
  });

  fastify.post('/loyalty/scan', async (request, reply) => {
    if (
      !isPosAuthorized(request.headers as Record<string, unknown>, options.posScanApiKeys ?? [])
    ) {
      reply.code(401);
      return { error: 'Unauthorized POS request.' };
    }

    const body = (request.body ?? {}) as {
      qrToken?: string;
      receiptId?: string;
      totalRon?: number;
      storeId?: string;
      terminalId?: string;
    };
    const qrToken = (body.qrToken ?? '').trim();
    const receiptId = (body.receiptId ?? '').trim();
    const storeId = (body.storeId ?? '').trim() || undefined;
    const terminalId = (body.terminalId ?? '').trim() || undefined;
    const totalRon = normalizeUnitPriceRon(body.totalRon);

    if (!qrToken || !receiptId || totalRon === null || totalRon <= 0) {
      reply.code(400);
      return { error: 'Invalid scan payload.' };
    }

    const parsed = parseSignedOrUnsignedToken(qrToken, options.loyaltySigningKey);
    if (!parsed) {
      reply.code(400);
      return { error: 'Invalid QR token.' };
    }

    const tokenType = parsed.payload.type;
    const userId = typeof parsed.payload.sub === 'string' ? parsed.payload.sub : '';
    const email = typeof parsed.payload.email === 'string' ? parsed.payload.email : '';

    if (tokenType !== 'loyalty-member' || !userId || !email) {
      reply.code(400);
      return { error: 'Unsupported QR token.' };
    }

    const user = await store.getUserById(userId);
    if (!user) {
      reply.code(404);
      return { error: 'Loyalty member not found.' };
    }
    if (normalizeEmail(user.email) !== normalizeEmail(email)) {
      reply.code(400);
      return { error: 'QR token does not match account.' };
    }

    const profile = await store.getLoyaltyProfile(userId);
    const processedReceipts = new Set(profile.processedReceiptIds ?? []);
    if (processedReceipts.has(receiptId)) {
      const orders = await store.getOrders(userId);
      return {
        ok: true,
        duplicated: true,
        pointsAdded: 0,
        summary: {
          ...resolveLoyaltySummary(profile, orders),
          ...(profile.lastVoucherCode
            ? {
                lastVoucher: {
                  code: profile.lastVoucherCode,
                  valueRon: profile.lastVoucherValueRon ?? 0,
                  createdAt: profile.lastVoucherCreatedAt,
                  expiresAt: profile.lastVoucherExpiresAt,
                  qrToken: profile.lastVoucherQrToken,
                },
              }
            : {}),
          ...(profile.loyaltyQrToken
            ? {
                loyaltyQrToken: profile.loyaltyQrToken,
                loyaltyQrCreatedAt: profile.loyaltyQrCreatedAt,
              }
            : {}),
        },
      };
    }

    const pointsAdded = Math.max(1, Math.floor(totalRon * POINTS_PER_RON));
    processedReceipts.add(receiptId);
    const nextLedger = [
      {
        id: randomUUID(),
        kind: 'earn' as const,
        pointsDelta: pointsAdded,
        amountRon: totalRon,
        receiptId,
        ...(storeId ? { storeId } : {}),
        ...(terminalId ? { terminalId } : {}),
        createdAt: new Date().toISOString(),
      },
      ...(profile.loyaltyLedger ?? []),
    ].slice(0, 300);

    const nextProfile: LoyaltyProfile = {
      ...profile,
      earnedPointsFromScans: Math.max(0, (profile.earnedPointsFromScans ?? 0) + pointsAdded),
      processedReceiptIds: Array.from(processedReceipts).slice(-1000),
      loyaltyLedger: nextLedger,
    };
    await store.setLoyaltyProfile(userId, nextProfile);
    await addNotificationWithPush(
      store,
      userId,
      'Puncte adăugate în magazin',
      `Ai primit ${pointsAdded} puncte pentru bonul ${receiptId}.`,
      { receiptId, pointsAdded: `${pointsAdded}` },
    );

    const orders = await store.getOrders(userId);
    return {
      ok: true,
      duplicated: false,
      pointsAdded,
      customer: { id: user.id, email: user.email, name: user.name },
      summary: {
        ...resolveLoyaltySummary(nextProfile, orders),
        ...(nextProfile.lastVoucherCode
          ? {
              lastVoucher: {
                code: nextProfile.lastVoucherCode,
                valueRon: nextProfile.lastVoucherValueRon ?? 0,
                createdAt: nextProfile.lastVoucherCreatedAt,
                expiresAt: nextProfile.lastVoucherExpiresAt,
                qrToken: nextProfile.lastVoucherQrToken,
              },
            }
          : {}),
        ...(nextProfile.loyaltyQrToken
          ? {
              loyaltyQrToken: nextProfile.loyaltyQrToken,
              loyaltyQrCreatedAt: nextProfile.loyaltyQrCreatedAt,
            }
          : {}),
      },
    };
  });

  fastify.post('/loyalty/voucher/redeem-scan', async (request, reply) => {
    if (
      !isPosAuthorized(request.headers as Record<string, unknown>, options.posScanApiKeys ?? [])
    ) {
      reply.code(401);
      return { error: 'Unauthorized POS request.' };
    }

    const body = (request.body ?? {}) as {
      qrToken?: string;
      receiptId?: string;
      storeId?: string;
      terminalId?: string;
    };
    const qrToken = (body.qrToken ?? '').trim();
    const receiptId = (body.receiptId ?? '').trim();
    const storeId = (body.storeId ?? '').trim() || undefined;
    const terminalId = (body.terminalId ?? '').trim() || undefined;

    if (!qrToken || !receiptId) {
      reply.code(400);
      return { error: 'Invalid voucher scan payload.' };
    }

    const parsed = parseSignedOrUnsignedToken(qrToken, options.loyaltySigningKey);
    if (!parsed) {
      reply.code(400);
      return { error: 'Invalid voucher token.' };
    }

    const tokenType = parsed.payload.type;
    const userId = typeof parsed.payload.sub === 'string' ? parsed.payload.sub : '';
    const code = typeof parsed.payload.code === 'string' ? parsed.payload.code : '';
    const valueRon = normalizeUnitPriceRon(parsed.payload.valueRon);
    const expiresAt = typeof parsed.payload.expiresAt === 'string' ? parsed.payload.expiresAt : '';

    if (
      tokenType !== 'voucher' ||
      !userId ||
      !code ||
      valueRon === null ||
      valueRon <= 0 ||
      !expiresAt
    ) {
      reply.code(400);
      return { error: 'Unsupported voucher token.' };
    }

    const expiresTimestamp = Date.parse(expiresAt);
    if (!Number.isFinite(expiresTimestamp) || Date.now() > expiresTimestamp) {
      reply.code(400);
      return { error: 'Voucher expired.' };
    }

    const user = await store.getUserById(userId);
    if (!user) {
      reply.code(404);
      return { error: 'Voucher owner not found.' };
    }

    const profile = await store.getLoyaltyProfile(userId);
    const redeemedCodes = new Set(profile.redeemedVoucherCodes ?? []);
    if (redeemedCodes.has(code)) {
      return { ok: true, duplicated: true, voucherCode: code, valueRon };
    }

    redeemedCodes.add(code);
    const nowIsoValue = new Date().toISOString();
    const wallet = normalizeVoucherWallet(profile);
    const nextVoucherHistory = wallet.items.map((item) =>
      item.code === code
        ? { ...item, status: 'used' as const, usedAt: nowIsoValue, receiptId }
        : item,
    );
    const nextLedger = [
      {
        id: randomUUID(),
        kind: 'voucher-redeemed' as const,
        pointsDelta: 0,
        amountRon: valueRon,
        receiptId,
        ...(storeId ? { storeId } : {}),
        ...(terminalId ? { terminalId } : {}),
        createdAt: nowIsoValue,
      },
      ...(profile.loyaltyLedger ?? []),
    ].slice(0, 300);

    const nextProfile: LoyaltyProfile = {
      ...profile,
      redeemedVoucherCodes: Array.from(redeemedCodes).slice(-500),
      voucherHistory: nextVoucherHistory,
      loyaltyLedger: nextLedger,
    };
    await store.setLoyaltyProfile(userId, nextProfile);
    await addNotificationWithPush(
      store,
      userId,
      'Voucher folosit în magazin',
      `Voucherul ${code} (${valueRon} RON) a fost utilizat la casă.`,
      { voucherCode: code, receiptId },
    );

    return {
      ok: true,
      duplicated: false,
      voucherCode: code,
      valueRon,
      customer: { id: user.id, email: user.email, name: user.name },
    };
  });
};
