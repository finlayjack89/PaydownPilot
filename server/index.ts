import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn } from "child_process";

const app = express();

// Helper function to check if Python backend is ready
async function waitForPythonBackend(
  url: string,
  maxAttempts: number = 30,
  delayMs: number = 1000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        const data = await response.json();
        log(`Python backend is ready: ${JSON.stringify(data)}`);
        return true;
      }
    } catch (error) {
      // Python not ready yet, continue polling
      if (attempt === 1) {
        log(`Waiting for Python backend to be ready...`);
      }
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return false;
}

// Start Python FastAPI backend in development mode
let pythonProcess: any = null;
let pythonRestartCount = 0;
const MAX_PYTHON_RESTARTS = 5;
let shouldRestartPython = true;

function startPythonBackend() {
  if (pythonRestartCount >= MAX_PYTHON_RESTARTS) {
    console.error(`[Python] Max restart attempts (${MAX_PYTHON_RESTARTS}) exceeded. Not restarting.`);
    return;
  }

  log("Starting Python FastAPI backend on port 8000...");
  // In production, don't use --reload flag for better performance
  const uvicornArgs = process.env.NODE_ENV === "development"
    ? ["main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]
    : ["main:app", "--host", "127.0.0.1", "--port", "8000"];
    
  pythonProcess = spawn("uvicorn", uvicornArgs, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  pythonProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[Python] ${data.toString().trim()}`);
  });

  pythonProcess.stderr?.on("data", (data: Buffer) => {
    const message = data.toString().trim();
    console.error(`[Python] ${message}`);
    
    // Check for critical errors that indicate the process won't recover
    if (message.includes("Address already in use") || 
        message.includes("Cannot bind to port")) {
      console.error("[Python] Critical error detected. Port 8000 may be in use.");
      shouldRestartPython = false;
    }
  });

  pythonProcess.on("error", (error: Error) => {
    console.error("[Python] Failed to start:", error.message);
  });

  pythonProcess.on("exit", (code: number, signal: string) => {
    if (code !== 0 && code !== null) {
      console.error(`[Python] Exited unexpectedly with code ${code}`);
      
      // Auto-restart if we should and haven't exceeded max restarts
      if (shouldRestartPython && pythonRestartCount < MAX_PYTHON_RESTARTS) {
        pythonRestartCount++;
        console.log(`[Python] Attempting restart ${pythonRestartCount}/${MAX_PYTHON_RESTARTS} in 2 seconds...`);
        setTimeout(() => {
          startPythonBackend();
        }, 2000);
      }
    } else if (signal) {
      console.log(`[Python] Terminated by signal ${signal}`);
    }
  });
}

// Start Python backend in both development and production
startPythonBackend();

// Cleanup Python process on exit
process.on("exit", () => {
  shouldRestartPython = false; // Prevent restart during shutdown
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

process.on("SIGINT", () => {
  shouldRestartPython = false; // Prevent restart during shutdown
  if (pythonProcess) {
    pythonProcess.kill();
  }
  process.exit();
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Wait for Python backend to be ready in both development and production
  const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
  const pythonReady = await waitForPythonBackend(pythonBackendUrl);
  
  if (!pythonReady) {
    console.error(`[Python] Failed to start within 30 seconds. Plan generation will not work.`);
    console.error(`[Python] Check Python logs above for errors.`);
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
