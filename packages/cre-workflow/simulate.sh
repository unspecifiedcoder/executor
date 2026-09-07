#!/usr/bin/env bash
set -euo pipefail

# Runs the CRE CLI's local simulation against workflow.ts and saves the
# output for hackathon submission (a live DON run isn't reproducible on
# demand, so this log is the artifact judges can check).
cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v cre &> /dev/null; then
  echo "Chainlink CRE CLI not found. Install per https://docs.chain.link/cre" >&2
  exit 1
fi

cre workflow simulate ./workflow.ts --config ./cre.config.json | tee simulation.log
