#!/bin/bash
set -e

# Install dependencies
pnpm install

# Build the web app
pnpm --filter @chainbook/web build
