#!/bin/bash
# Start both Node.js and Python backends

# Start Python FastAPI backend on port 8000 in background
echo "Starting Python FastAPI backend on port 8000..."
uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
PYTHON_PID=$!

# Wait for Python backend to start
sleep 3

# Start Node.js application on port 5000
echo "Starting Node.js application on port 5000..."
npm run dev

# If Node app exits, kill Python backend
kill $PYTHON_PID 2>/dev/null
