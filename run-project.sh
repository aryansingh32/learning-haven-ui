#!/bin/bash

# Exit on error
set -e

echo "========================================"
echo " Starting Learning Haven Local Setup"
echo "========================================"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null
then
    echo "❌ Error: pnpm is not installed. Please install it first (npm i -g pnpm)."
    exit 1
fi

echo "📦 Installing dependencies..."
pnpm install

echo "
🚀 The following apps will be started via Turborepo:"
echo "   - apps/api   : Express API Server (tsx)"
echo "   - apps/web   : Main Web Application (Vite + Node compile server)"
echo "   - apps/admin : Admin Dashboard (Vite)"
echo "
Note: Ensure you have your environment variables set correctly (e.g. Supabase, Redis, PostgreSQL) as defined in .env.example.
"

echo "⏳ Starting development servers..."
pnpm run dev

