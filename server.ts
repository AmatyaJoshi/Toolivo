import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiController, apiRateLimiter, getSafeAppUrl } from './src/server/controllers/apiController.ts';
import { BillingController } from './src/server/controllers/billingController.ts';
import { requireAdminAuth } from './src/server/services/adminAuth.ts';
import { injectRouteSeo } from './src/server/seoRenderer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  // Baseline security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CRITICAL: Dodo Payments Standard Webhooks endpoint MUST receive raw unparsed bytes BEFORE express.json()
  app.post(
    '/api/payments/dodo/webhook',
    express.raw({ type: 'application/json', limit: '2mb' }),
    BillingController.handleDodoWebhook
  );

  // JSON parsing & rate limiting for API routes
  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', apiRateLimiter);

  // Core catalog & health routes
  app.get('/api/health', ApiController.health);
  app.get('/api/tools', ApiController.listTools);
  app.get('/api/tools/:slug', ApiController.getTool);
  app.get('/api/catalog.json', ApiController.catalogJson);

  // Dodo Payments: Pro Plans, Multi-Currency Checkout & Accountless Entitlements
  app.get('/api/pro/plans', BillingController.getProPlans);
  app.post('/api/pro/checkout', BillingController.createProCheckout);
  app.get('/api/checkout/status/:sessionId', BillingController.getCheckoutStatus);
  app.post('/api/pro/entitlement/validate', BillingController.validateEntitlement);
  app.post('/api/pro/entitlement/recover', BillingController.recoverByEmail);
  app.post('/api/pro/entitlement/sync', BillingController.syncAccountEntitlement);
  app.post('/api/pro/credits/consume', BillingController.consumeCredits);

  // Dodo Payments: Advertising / Sponsor Slots, Checkout & Tracking
  app.get('/api/sponsors', BillingController.getSponsors);
  app.post('/api/sponsors/checkout', BillingController.createSponsorCheckout);
  app.post('/api/sponsors/:campaignId/impression', BillingController.trackSponsorImpression);
  app.get('/api/sponsors/:campaignId/click', BillingController.trackSponsorClick);

  // Admin Authentication & Protected Pricing / Sponsor Approval Dashboard
  app.get('/api/admin/auth/status', BillingController.getAdminAuthStatus);
  app.post('/api/admin/auth/claim', BillingController.claimAdminPassword);
  app.post('/api/admin/auth/login', BillingController.loginAdmin);
  app.get('/api/admin/overview', requireAdminAuth, BillingController.getAdminOverview);
  app.patch('/api/admin/pricing/:itemId', requireAdminAuth, BillingController.updateAdminPricingItem);
  app.patch('/api/admin/sponsors/slots/:slotId', requireAdminAuth, BillingController.updateAdminSponsorSlot);
  app.post('/api/admin/sponsors/campaigns/:campaignId', requireAdminAuth, BillingController.manageAdminCampaign);
  app.post('/api/admin/payments/:paymentId/refund', requireAdminAuth, BillingController.adminRefundPayment);
  app.post('/api/admin/subscriptions/:subscriptionId/cancel', requireAdminAuth, BillingController.adminCancelSubscription);

  // Technical SEO, OpenGraph Social Cards & AI-Agent (GEO) discovery endpoints
  app.get('/sitemap.xml', ApiController.sitemapXml);
  app.get('/robots.txt', ApiController.robotsTxt);
  app.get('/llms.txt', ApiController.llmsTxt);
  app.get('/llms-full.txt', ApiController.llmsFullTxt);
  app.get('/og.svg', ApiController.ogImageSvg);
  app.get('/og/:slug', ApiController.ogImageSvg);

  // API 404 fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    // Server-injected per-route SEO & JSON-LD even in dev mode
    app.use('*', async (req, res, next) => {
      if (req.method !== 'GET') return next();
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        const rawTemplate = fs.readFileSync(templatePath, 'utf-8');
        const baseUrl = getSafeAppUrl(req);
        const seoHtml = injectRouteSeo(rawTemplate, req.originalUrl, baseUrl);
        const transformed = await vite.transformIndexHtml(req.originalUrl, seoHtml);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(transformed);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distDir, 'index.html');
    const cachedTemplate = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : null;

    app.use(express.static(distDir, { index: false }));

    app.get('*', (req, res) => {
      const template = cachedTemplate ?? (fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : null);
      if (!template) {
        return res.status(503).send('Build output missing. Run npm run build first.');
      }
      const baseUrl = getSafeAppUrl(req);
      const html = injectRouteSeo(template, req.originalUrl, baseUrl);
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Toolivo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Toolivo server:', err);
  process.exit(1);
});
