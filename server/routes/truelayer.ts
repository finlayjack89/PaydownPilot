import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import {
  generateAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  fetchAccounts,
  fetchAccountBalance,
  fetchAllTransactions,
  fetchAllDirectDebits,
  encryptToken,
  decryptToken,
} from "../truelayer";
import { z } from "zod";

const REDIRECT_URI = process.env.TRUELAYER_REDIRECT_URI || 
  `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/api/truelayer/callback`;

export function registerTrueLayerRoutes(app: Express) {
  app.get("/api/truelayer/auth-url", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (userId === "guest-user") {
        return res.status(403).json({ 
          message: "Bank connection is not available for guest users. Please create an account." 
        });
      }

      const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
      const authUrl = generateAuthUrl(REDIRECT_URI, state);

      res.json({ authUrl, redirectUri: REDIRECT_URI });
    } catch (error: any) {
      console.error("[TrueLayer] Error generating auth URL:", error);
      res.status(500).json({ 
        message: "Failed to generate authentication URL",
        error: error.message 
      });
    }
  });

  app.get("/api/truelayer/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error("[TrueLayer] Auth callback error:", error);
        return res.redirect(`/budget?error=${encodeURIComponent(String(error))}`);
      }

      if (!code || typeof code !== "string") {
        return res.redirect("/budget?error=missing_code");
      }

      let userId: string | null = null;
      if (state && typeof state === "string") {
        try {
          const decoded = JSON.parse(Buffer.from(state, "base64").toString());
          userId = decoded.userId;
        } catch (e) {
          console.error("[TrueLayer] Failed to decode state:", e);
        }
      }

      if (!userId) {
        const sessionUser = req.user as any;
        if (sessionUser?.id) {
          userId = sessionUser.id;
        } else {
          return res.redirect("/budget?error=session_expired");
        }
      }

      const tokenResponse = await exchangeCodeForToken(code, REDIRECT_URI);

      const consentExpiresAt = new Date(
        Date.now() + tokenResponse.expires_in * 1000
      );

      const existingItem = await storage.getTrueLayerItemByUserId(userId as string);
      
      if (existingItem) {
        await storage.updateTrueLayerItem(existingItem.id, {
          accessTokenEncrypted: encryptToken(tokenResponse.access_token),
          refreshTokenEncrypted: tokenResponse.refresh_token 
            ? encryptToken(tokenResponse.refresh_token) 
            : null,
          consentExpiresAt,
          lastSyncedAt: new Date(),
        });
      } else {
        await storage.createTrueLayerItem({
          userId: userId as string,
          accessTokenEncrypted: encryptToken(tokenResponse.access_token),
          refreshTokenEncrypted: tokenResponse.refresh_token 
            ? encryptToken(tokenResponse.refresh_token) 
            : null,
          consentExpiresAt,
          provider: null,
          lastSyncedAt: new Date(),
        });
      }

      res.redirect("/budget?connected=true");
    } catch (error: any) {
      console.error("[TrueLayer] Callback error:", error);
      res.redirect(`/budget?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.get("/api/truelayer/status", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (userId === "guest-user") {
        return res.json({ 
          connected: false,
          message: "Guest users cannot connect bank accounts"
        });
      }

      const item = await storage.getTrueLayerItemByUserId(userId);
      
      if (!item) {
        return res.json({ connected: false });
      }

      const isExpired = item.consentExpiresAt && 
        new Date(item.consentExpiresAt) < new Date();

      res.json({
        connected: !isExpired,
        lastSynced: item.lastSyncedAt,
        consentExpires: item.consentExpiresAt,
        needsReauth: isExpired,
      });
    } catch (error: any) {
      console.error("[TrueLayer] Status check error:", error);
      res.status(500).json({ 
        message: "Failed to check connection status",
        error: error.message 
      });
    }
  });

  app.post("/api/truelayer/disconnect", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (userId === "guest-user") {
        return res.status(403).json({ 
          message: "Guest users cannot disconnect bank accounts" 
        });
      }

      await storage.deleteTrueLayerItem(userId);
      
      res.json({ 
        success: true, 
        message: "Bank connection removed successfully" 
      });
    } catch (error: any) {
      console.error("[TrueLayer] Disconnect error:", error);
      res.status(500).json({ 
        message: "Failed to disconnect bank",
        error: error.message 
      });
    }
  });

  app.get("/api/truelayer/accounts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (userId === "guest-user") {
        return res.status(403).json({ 
          message: "Guest users cannot access bank accounts" 
        });
      }

      const item = await storage.getTrueLayerItemByUserId(userId);
      
      if (!item) {
        return res.status(404).json({ 
          message: "No bank account connected. Please connect your bank first." 
        });
      }

      let accessToken = decryptToken(item.accessTokenEncrypted);

      const isExpired = item.consentExpiresAt && 
        new Date(item.consentExpiresAt) < new Date();

      if (isExpired && item.refreshTokenEncrypted) {
        try {
          const refreshToken = decryptToken(item.refreshTokenEncrypted);
          const newTokens = await refreshAccessToken(refreshToken);
          
          accessToken = newTokens.access_token;
          
          await storage.updateTrueLayerItem(item.id, {
            accessTokenEncrypted: encryptToken(newTokens.access_token),
            refreshTokenEncrypted: newTokens.refresh_token 
              ? encryptToken(newTokens.refresh_token) 
              : item.refreshTokenEncrypted,
            consentExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          });
        } catch (refreshError) {
          console.error("[TrueLayer] Token refresh failed:", refreshError);
          return res.status(401).json({ 
            message: "Bank connection expired. Please reconnect your bank.",
            needsReauth: true 
          });
        }
      }

      const accountsResponse = await fetchAccounts(accessToken);

      const accountsWithBalance = await Promise.all(
        accountsResponse.results.map(async (account) => {
          try {
            const balanceResponse = await fetchAccountBalance(
              accessToken,
              account.account_id
            );
            return {
              ...account,
              balance: balanceResponse.results[0],
            };
          } catch (e) {
            return account;
          }
        })
      );

      await storage.updateTrueLayerItem(item.id, {
        lastSyncedAt: new Date(),
      });

      res.json({
        success: true,
        accounts: accountsWithBalance,
      });
    } catch (error: any) {
      console.error("[TrueLayer] Fetch accounts error:", error);
      res.status(500).json({ 
        message: "Failed to fetch bank accounts",
        error: error.message 
      });
    }
  });

  app.post("/api/truelayer/sync-transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { days = 90 } = req.body;
      
      if (userId === "guest-user") {
        return res.status(403).json({ 
          message: "Guest users cannot sync transactions" 
        });
      }

      const item = await storage.getTrueLayerItemByUserId(userId);
      
      if (!item) {
        return res.status(404).json({ 
          message: "No bank account connected. Please connect your bank first." 
        });
      }

      let accessToken = decryptToken(item.accessTokenEncrypted);

      const transactions = await fetchAllTransactions(
        accessToken, 
        Math.min(Math.max(days, 30), 365)
      );
      
      const directDebits = await fetchAllDirectDebits(accessToken);

      await storage.updateTrueLayerItem(item.id, {
        lastSyncedAt: new Date(),
      });

      console.log(`[TrueLayer] Synced ${transactions.length} transactions and ${directDebits.length} direct debits for user ${userId}`);

      res.json({
        success: true,
        transactionCount: transactions.length,
        directDebitCount: directDebits.length,
        transactions,
        directDebits,
      });
    } catch (error: any) {
      console.error("[TrueLayer] Sync transactions error:", error);
      res.status(500).json({ 
        message: "Failed to sync transactions",
        error: error.message 
      });
    }
  });
}
