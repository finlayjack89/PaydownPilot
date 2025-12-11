import type { Express } from "express";
import { db } from "../db";
import { lenderProducts, type LenderProduct } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export function registerLenderProductRoutes(app: Express) {
  app.get("/api/lender-products/lenders", async (req, res) => {
    try {
      const country = (req.query.country as string) || "UK";
      
      const products = await db
        .selectDistinct({ lenderName: lenderProducts.lenderName })
        .from(lenderProducts)
        .where(eq(lenderProducts.country, country))
        .orderBy(lenderProducts.lenderName);
      
      const lenders = products.map(p => p.lenderName);
      res.json(lenders);
    } catch (error: any) {
      console.error("[LenderProducts] Error fetching lenders:", error);
      res.status(500).json({ message: "Failed to fetch lenders" });
    }
  });

  app.get("/api/lender-products", async (req, res) => {
    try {
      const lenderName = req.query.lender as string;
      const country = (req.query.country as string) || "UK";
      
      let query = db.select().from(lenderProducts);
      
      if (lenderName) {
        query = query.where(
          and(
            eq(lenderProducts.lenderName, lenderName),
            eq(lenderProducts.country, country)
          )
        ) as typeof query;
      } else {
        query = query.where(eq(lenderProducts.country, country)) as typeof query;
      }
      
      const products = await query.orderBy(lenderProducts.productName);
      res.json(products);
    } catch (error: any) {
      console.error("[LenderProducts] Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/lender-products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const [product] = await db
        .select()
        .from(lenderProducts)
        .where(eq(lenderProducts.id, id));
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      console.error("[LenderProducts] Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
}
