import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import { Readable } from "stream";
import sharp from "sharp";
import { HMDA_MASTER_PLAN_MAPS } from "../client/src/data/hmdaMasterPlanMaps";
import { getFlashNews } from "./flashNews";

import { AccessToken } from "livekit-server-sdk";

const SALT_ROUNDS = 12;
const MASTER_PLAN_PREVIEW_CACHE_LIMIT = 8;
const masterPlanPreviewCache = new Map<string, Buffer>();
const masterPlanPreviewRequests = new Map<string, Promise<Buffer>>();
const propertyEventRegistrations = new Map<
  string,
  Map<string, { name: string; phone: string; userId?: string; registeredAt: string }>
>();

async function getMasterPlanPreview(mapId: string): Promise<Buffer> {
  const cachedPreview = masterPlanPreviewCache.get(mapId);
  if (cachedPreview) {
    masterPlanPreviewCache.delete(mapId);
    masterPlanPreviewCache.set(mapId, cachedPreview);
    return cachedPreview;
  }

  const pendingRequest = masterPlanPreviewRequests.get(mapId);
  if (pendingRequest) return pendingRequest;

  const mapSheet = HMDA_MASTER_PLAN_MAPS.find((map) => map.id === mapId);
  if (!mapSheet) throw new Error("Unknown HMDA map sheet");

  const request = (async () => {
    const response = await fetch(mapSheet.imageUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`HMDA image request failed with status ${response.status}`);
    }

    const sourceImage = Buffer.from(await response.arrayBuffer());
    if (sourceImage.byteLength > 50 * 1024 * 1024) {
      throw new Error("HMDA image is larger than the supported preview limit");
    }

    return sharp(sourceImage, { limitInputPixels: 250_000_000 })
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  })();

  masterPlanPreviewRequests.set(mapId, request);
  try {
    const preview = await request;
    masterPlanPreviewCache.set(mapId, preview);
    while (masterPlanPreviewCache.size > MASTER_PLAN_PREVIEW_CACHE_LIMIT) {
      const oldestMapId = masterPlanPreviewCache.keys().next().value;
      if (!oldestMapId) break;
      masterPlanPreviewCache.delete(oldestMapId);
    }
    return preview;
  } finally {
    masterPlanPreviewRequests.delete(mapId);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/news/flash", async (req, res) => {
    try {
      const region = req.query.region === "dubai" ? "dubai" : "india";
      const news = await getFlashNews(
        req.query.refresh === "true",
        region,
      );
      return res
        .status(200)
        .set("Cache-Control", "no-store")
        .json(news);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Google News could not be reached. Please try again shortly.";
      return res.status(502).set("Cache-Control", "no-store").json({ message });
    }
  });

  app.get("/api/master-plan/maps/:mapId/preview.webp", async (req, res) => {
    const mapId = req.params.mapId;
    if (!HMDA_MASTER_PLAN_MAPS.some((map) => map.id === mapId)) {
      return res.status(404).end();
    }

    try {
      const preview = await getMasterPlanPreview(mapId);
      return res
        .status(200)
        .type("image/webp")
        .set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400")
        .send(preview);
    } catch (error) {
      console.error(`HMDA map preview error for ${mapId}:`, error);
      return res.status(502).end();
    }
  });

  app.get("/api/master-plan/maps/:mapId/download", async (req, res) => {
    const mapSheet = HMDA_MASTER_PLAN_MAPS.find(
      (map) => map.id === req.params.mapId,
    );
    if (!mapSheet) return res.status(404).end();

    try {
      const response = await fetch(mapSheet.imageUrl, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok || !response.body) {
        return res.status(502).end();
      }

      res.status(200);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="hmda-${mapSheet.id}.jpg"`,
      );
      res.setHeader("Cache-Control", "no-store");
      const contentLength = response.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);
      return Readable.fromWeb(response.body as any).pipe(res);
    } catch (error) {
      console.error(`HMDA map download error for ${mapSheet.id}:`, error);
      return res.status(502).end();
    }
  });

  // The lake geometry matches the digitized FTL/buffer layer used by the
  // reference map. Keep the provider token server-side and proxy only tiles
  // needed by the MapLibre viewport.
  app.get("/api/lakes/tiles/:z/:x/:y.pbf", async (req, res) => {
    const { z, x, y } = req.params;
    const tileUrl = new URL(
      `https://a.tiles.mapbox.com/v4/av1acre.c140rt5n/${z}/${x}/${y}.vector.pbf`,
    );
    tileUrl.searchParams.set(
      "access_token",
      "pk.eyJ1IjoiYXYxYWNyZSIsImEiOiJjbTNvMjR5OGIxZmFpMmxwZXZqam5jZWkzIn0.E16ZeusP-JQe-hkleW3P-Q",
    );

    try {
      const response = await fetch(tileUrl, {
        headers: { Referer: "https://1acre.in/" },
      });

      if (!response.ok) {
        return res.status(response.status).end();
      }

      const tile = Buffer.from(await response.arrayBuffer());
      res
        .status(200)
        .type("application/x-protobuf")
        .set("Cache-Control", "public, max-age=86400")
        .send(tile);
    } catch (error) {
      console.error("Lake tile proxy error:", error);
      res.status(502).end();
    }
  });
  
  app.post("/api/auth/verify-persona", async (req, res) => {
    try {
      const { slug, pin } = z.object({ slug: z.string(), pin: z.string() }).parse(req.body);
      const user = await storage.getUserBySlug(slug);
      
      console.log("Verify Persona - Slug:", slug, "PIN provided:", pin);
      
      if (!user) {
        console.log("Verify Persona - User not found for slug:", slug);
        return res.status(404).json({ message: "Persona not found" });
      }

      console.log("Verify Persona - User found:", user.id, "User PIN in DB:", user.pin);

      // Normalize PINs to strings for comparison and trim whitespace
      const pinInDb = String(user.pin || "").trim();
      const providedPin = String(pin || "").trim();
      
      console.log("Verify Persona - Comparing PINs:", { pinInDb, providedPin, slug });

      if (pinInDb !== providedPin) {
        console.log("Verify Persona - PIN mismatch for slug:", slug);
        return res.status(401).json({ message: "Invalid PIN" });
      }

      const { password: _, ...safeUser } = user;
      res.status(200).json(safeUser);
    } catch (err) {
      console.error("Auth error:", err);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/livekit/token", async (req, res) => {
    const roomName = "pitch-room";
    const participantName = "user-" + Math.floor(Math.random() * 1000);
    
    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return res.status(500).json({ error: "LiveKit credentials not configured" });
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
      }
    );
    at.addGrant({ roomJoin: true, room: roomName });

    res.json({ token: await at.toJwt() });
  });

  app.post("/api/property-events/:eventId/register", async (req, res) => {
    try {
      const { name, phone, userId } = z
        .object({
          name: z.string().trim().min(2),
          phone: z.string().trim().min(7),
          userId: z.string().optional(),
        })
        .parse(req.body);
      const eventId = z.string().min(1).parse(req.params.eventId);
      const attendeeKey = userId || phone;
      const registrations =
        propertyEventRegistrations.get(eventId) ||
        new Map<
          string,
          { name: string; phone: string; userId?: string; registeredAt: string }
        >();
      const existing = registrations.get(attendeeKey);

      if (existing) {
        return res.status(200).json({
          registered: true,
          registration: existing,
          attendeeCount: registrations.size,
        });
      }

      const registration = {
        name,
        phone,
        ...(userId ? { userId } : {}),
        registeredAt: new Date().toISOString(),
      };
      registrations.set(attendeeKey, registration);
      propertyEventRegistrations.set(eventId, registrations);

      return res.status(201).json({
        registered: true,
        registration,
        attendeeCount: registrations.size,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      return res.status(500).json({ message: "Could not register for event" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(input.email || "");
      
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const passwordMatch = await bcrypt.compare(input.password || "", user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const { password: _, ...safeUser } = user;
      res.status(200).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      if (input.email) {
        const existingUser = await storage.getUserByEmail(input.email);
        if (existingUser) {
          const { password: _, ...updateData } = input as any;
          const updatedUser = await storage.updateUser(existingUser.id, updateData);
          
          let userWithSlug = updatedUser;
          if (!existingUser.uniqueSlug && storage.getUserBySlug) {
            let uniqueSlug = "";
            const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 10) {
              attempts++;
              uniqueSlug = "";
              for (let i = 0; i < 5; i++) {
                uniqueSlug += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              const existing = await storage.getUserBySlug(uniqueSlug);
              if (!existing) isUnique = true;
            }
            if (isUnique) {
              userWithSlug = await storage.updateUser(existingUser.id, { uniqueSlug } as any);
            }
          }
          
          const { password: __, ...safeUser } = userWithSlug;
          return res.status(200).json(safeUser);
        }
      }

      const hashedPassword = input.password ? await bcrypt.hash(input.password, SALT_ROUNDS) : await bcrypt.hash(Math.random().toString(), SALT_ROUNDS);
      
      let uniqueSlug = "";
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10 && storage.getUserBySlug) {
        attempts++;
        uniqueSlug = "";
        for (let i = 0; i < 5; i++) {
          uniqueSlug += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existing = await storage.getUserBySlug(uniqueSlug);
        if (!existing) {
          isUnique = true;
        }
      }

      if (!isUnique) {
        throw new Error("Could not generate a unique slug");
      }

      const user = await storage.createUser({ 
        ...input, 
        email: input.email || "",
        password: hashedPassword,
        uniqueSlug
      } as any);
      
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/user/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/user/check-slug/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const existing = await storage.getUserBySlug(slug);
      res.json({ taken: !!existing });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/user/slug", async (req, res) => {
    try {
      const { uniqueSlug, userId } = z.object({ 
        uniqueSlug: z.string(),
        userId: z.string().optional()
      }).parse(req.body);
      
      let user;
      if (userId) {
        user = await storage.getUser(userId);
      } else {
        const users = await storage.getUsers?.() || [];
        user = users[0];
      }
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const existing = await storage.getUserBySlug(uniqueSlug);
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ message: "Persona code already taken" });
      }

      const updatedUser = await storage.updateUser(user.id, { uniqueSlug });
      const { password: _, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (err) {
      console.error("Update slug error:", err);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.patch("/api/user/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { password, id: _id, createdAt, pin, ...allowedFields } = req.body;
      
      const updateData = { ...allowedFields };
      if (pin !== undefined) {
        updateData.pin = pin;
      }
      
      const user = await storage.updateUser(id, updateData);
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      console.error("Update user error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/user/slug/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const user = await storage.getUserBySlug(slug);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Increment reachCount when someone views a profile
      // We'll increment it for every GET request to this endpoint
      
      const isSelf = req.query.self === 'true';
      if (!isSelf) {
        const now = new Date();
        const currentTimestamp = now.toISOString();
        const reachHistory = user.reachHistory || [];
        
        // Find if we have an entry within the last 12 hours
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        const lastEntry = reachHistory.length > 0 ? reachHistory[reachHistory.length - 1] : null;
        
        let newHistory = [...reachHistory];
        if (lastEntry && new Date(lastEntry.timestamp) > twelveHoursAgo) {
          // Update the last 12h entry
          newHistory[newHistory.length - 1] = { 
            ...lastEntry, 
            count: (lastEntry.count || 0) + 1 
          };
        } else {
          // Create a new 12h slot
          newHistory.push({ timestamp: currentTimestamp, count: 1 });
        }
        
        // Keep last 14 entries (7 days * 2 entries/day)
        if (newHistory.length > 14) {
          newHistory = newHistory.slice(-14);
        }

        await storage.updateUser(user.id, { 
          reachCount: (user.reachCount || 0) + 1,
          reachHistory: newHistory as any
        });
      }

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/connect", async (req, res) => {
    try {
      const { userId, targetSlug } = z.object({
        userId: z.string(),
        targetSlug: z.string()
      }).parse(req.body);

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const connections = user.connections || [];
      const now = new Date();
      
      // Filter out expired connections (older than 48h)
      const validConnections = connections.filter(conn => {
        const connectedAt = new Date(conn.connectedAt);
        const diffHours = (now.getTime() - connectedAt.getTime()) / (1000 * 60 * 60);
        return diffHours < 48;
      });

      if (!validConnections.find(c => c.slug === targetSlug)) {
        await storage.updateUser(userId, {
          connections: [...validConnections, { slug: targetSlug, connectedAt: now.toISOString() }]
        });
      } else if (validConnections.length !== connections.length) {
        // Just update if some expired even if target already exists
        await storage.updateUser(userId, {
          connections: validConnections
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Connect error:", err);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/user/:id/connections", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const connections = user.connections || [];
      const now = new Date();

      // Filter out expired connections (older than 48h)
      const validConnections = connections.filter(conn => {
        const connectedAt = new Date(conn.connectedAt);
        const diffHours = (now.getTime() - connectedAt.getTime()) / (1000 * 60 * 60);
        return diffHours < 48;
      });

      // Update user if some connections expired
      if (validConnections.length !== connections.length) {
        await storage.updateUser(user.id, { connections: validConnections });
      }

      const connectionProfiles = await Promise.all(
        validConnections.map(async (conn) => {
          const profile = await storage.getUserBySlug(conn.slug);
          if (profile) {
            const connectedAt = new Date(conn.connectedAt);
            const expiresAt = new Date(connectedAt.getTime() + 48 * 60 * 60 * 1000);
            return {
              name: profile.name || "Anonymous",
              industry: profile.industry || "Unknown",
              slug: profile.uniqueSlug,
              expiresAt: expiresAt.toISOString()
            };
          }
          return null;
        })
      );

      res.json(connectionProfiles.filter(Boolean));
    } catch (err) {
      console.error("Get connections error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/:id/click", async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = z.object({ type: z.enum(["insta", "linkedin", "whatsapp", "website"]) }).parse(req.body);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const field = `${type}Clicks` as keyof InsertUser;
      const currentCount = (user as any)[field] || 0;
      
      const updatedUser = await storage.updateUser(id, { [field]: currentCount + 1 });
      const { password: _, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (err) {
      console.error("Click track error:", err);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get("/api/tweet-video", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "Missing url parameter" });
      }

      const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
      if (!match) {
        return res.status(400).json({ message: "Invalid tweet URL" });
      }

      const [, username, tweetId] = match;

      const response = await fetch(
        `https://api.fxtwitter.com/${username}/status/${tweetId}`,
        { headers: { "User-Agent": "PersonaApp/1.0" } }
      );
      const data = (await response.json()) as any;

      const videos = data?.tweet?.media?.videos;
      if (!videos || videos.length === 0) {
        return res.status(404).json({ message: "No video found in this tweet" });
      }

      // Sort by quality — pick a mobile-friendly size (720p or best below it)
      const sorted = [...videos].sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
      const best = sorted.find((v: any) => (v.height || 9999) <= 1280) || sorted[sorted.length - 1];

      // Return a proxied URL so the browser never hits Twitter's CORS headers directly
      const proxyVideoUrl = `/api/tweet-video/proxy?url=${encodeURIComponent(best.url)}`;
      const thumbnailRaw = best.thumbnail_url || data?.tweet?.media?.photos?.[0]?.url || null;
      const proxyThumbnailUrl = thumbnailRaw
        ? `/api/tweet-video/proxy?url=${encodeURIComponent(thumbnailRaw)}`
        : null;

      return res.json({
        videoUrl: proxyVideoUrl,
        thumbnailUrl: proxyThumbnailUrl,
        duration: best.duration || null,
        width: best.width || null,
        height: best.height || null,
      });
    } catch (err: any) {
      console.error("Tweet video fetch error:", err);
      return res.status(500).json({ message: "Failed to fetch tweet video" });
    }
  });

  // Proxy endpoint — streams Twitter media through our server to avoid CORS
  app.get("/api/tweet-video/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing url");
    }

    // Only allow Twitter/X CDN domains
    if (!url.startsWith("https://video.twimg.com") && !url.startsWith("https://pbs.twimg.com")) {
      return res.status(403).send("Forbidden");
    }

    try {
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Referer": "https://twitter.com/",
        "Origin": "https://twitter.com",
      };

      // Forward Range header so seeking works
      const range = req.headers["range"];
      if (range) upstreamHeaders["Range"] = range;

      const upstream = await fetch(url, { headers: upstreamHeaders });

      // Forward status (200 or 206 partial content)
      res.status(upstream.status);

      // Forward relevant headers
      const forwardHeaders = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (!upstream.body) return res.end();

      // Pipe the upstream stream into the response
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (err: any) {
      console.error("Tweet video proxy error:", err);
      if (!res.headersSent) res.status(500).send("Proxy failed");
    }
  });

  return httpServer;
}
