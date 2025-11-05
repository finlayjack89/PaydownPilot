import type { Express } from "express";
import { db } from "../db";
import { plaidItems } from "@shared/schema";
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "../plaid";
import { encryptToken, decryptToken } from "../encryption";
import type { PlaidLinkTokenResponse, PlaidExchangeRequest, PlaidExchangeResponse, PlaidAccount } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const plaidAccountSchema = z.object({
  account_id: z.string().min(1),
  last_statement_balance: z.number().optional(),
  next_payment_due_date: z.string().optional(),
  aprs: z.array(z.object({
    apr_percentage: z.number().optional(),
  })).optional(),
});

export function registerPlaidRoutes(app: Express) {
  app.post("/api/plaid/create-link-token", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;
      
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: userId,
        },
        client_name: 'Paydown Pilot',
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
      });

      const linkTokenResponse: PlaidLinkTokenResponse = {
        linkToken: response.data.link_token,
      };

      res.json(linkTokenResponse);
    } catch (error: any) {
      console.error('[Plaid] Error creating link token:', error);
      res.status(500).json({ 
        message: 'Failed to create link token',
        error: error.message 
      });
    }
  });

  app.post("/api/plaid/exchange-token", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;
      const { publicToken } = req.body as PlaidExchangeRequest;

      if (!publicToken) {
        return res.status(400).json({ message: 'publicToken is required' });
      }

      // 1. Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // 2. Save encrypted access token to database
      const encrypted = encryptToken(accessToken);
      
      await db.insert(plaidItems).values({
        userId,
        itemId,
        accessTokenEncrypted: encrypted,
        lastSyncedAt: new Date(),
      }).onConflictDoUpdate({
        target: plaidItems.itemId,
        set: {
          accessTokenEncrypted: encrypted,
          lastSyncedAt: new Date(),
        },
      });

      // 3. Fetch liabilities data
      const liabilitiesResponse = await plaidClient.liabilitiesGet({
        access_token: accessToken,
      });

      // 4. Transform Plaid data to our format with validation
      const accounts: PlaidAccount[] = (liabilitiesResponse.data.liabilities?.credit || [])
        .filter((liability) => {
          const validated = plaidAccountSchema.safeParse(liability);
          if (!validated.success) {
            console.warn('[Plaid] Skipping invalid account:', validated.error);
            return false;
          }
          return true;
        })
        .map((liability) => ({
          accountId: liability.account_id || '',
          name: (liability as any).nickname || liability.account_id || 'Credit Account',
          balanceCents: Math.round((liability.last_statement_balance || 0) * 100),
          dueDay: liability.next_payment_due_date ? new Date(liability.next_payment_due_date).getDate() : undefined,
          apr: liability.aprs?.[0]?.apr_percentage ? Math.round(liability.aprs[0].apr_percentage * 100) : undefined,
        }))
        .filter(account => account.balanceCents > 0); // Only include accounts with positive balances

      const response: PlaidExchangeResponse = {
        accounts,
      };

      res.json(response);
    } catch (error: any) {
      console.error('[Plaid] Error exchanging token:', error);
      res.status(500).json({ 
        message: 'Failed to fetch account data',
        error: error.message 
      });
    }
  });

  app.post("/api/plaid/refresh-accounts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = (req.user as any).id;

      // Get all Plaid items for this user
      const items = await db.select().from(plaidItems).where(eq(plaidItems.userId, userId));

      if (items.length === 0) {
        return res.json({ accounts: [] });
      }

      // Fetch fresh data from all connected items
      const allAccounts: PlaidAccount[] = [];

      for (const item of items) {
        try {
          const accessToken = decryptToken(item.accessTokenEncrypted);
          
          const liabilitiesResponse = await plaidClient.liabilitiesGet({
            access_token: accessToken,
          });

          const accounts: PlaidAccount[] = (liabilitiesResponse.data.liabilities?.credit || [])
            .filter((liability) => {
              const validated = plaidAccountSchema.safeParse(liability);
              if (!validated.success) {
                console.warn('[Plaid] Skipping invalid account:', validated.error);
                return false;
              }
              return true;
            })
            .map((liability) => ({
              accountId: liability.account_id || '',
              name: (liability as any).nickname || liability.account_id || 'Credit Account',
              balanceCents: Math.round((liability.last_statement_balance || 0) * 100),
              dueDay: liability.next_payment_due_date ? new Date(liability.next_payment_due_date).getDate() : undefined,
              apr: liability.aprs?.[0]?.apr_percentage ? Math.round(liability.aprs[0].apr_percentage * 100) : undefined,
            }))
            .filter(account => account.balanceCents > 0);

          allAccounts.push(...accounts);

          // Update last synced timestamp
          await db.update(plaidItems)
            .set({ lastSyncedAt: new Date() })
            .where(eq(plaidItems.id, item.id));
        } catch (itemError: any) {
          console.error(`[Plaid] Error refreshing item ${item.itemId}:`, itemError);
          // Continue with other items even if one fails
        }
      }

      const response: PlaidExchangeResponse = {
        accounts: allAccounts,
      };

      res.json(response);
    } catch (error: any) {
      console.error('[Plaid] Error refreshing accounts:', error);
      res.status(500).json({ 
        message: 'Failed to refresh account data',
        error: error.message 
      });
    }
  });
}
