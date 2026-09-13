# Executor recording helper — Windows PowerShell version
#
# Same nine options as scripts/demo-day.sh, for recording from Windows rather
# than WSL. Keep the two in step if either changes.

#

# Run from the repository root:

#

# cd C:\Users\Pramod\GitHub\executor

# powershell -ExecutionPolicy Bypass -File .\scripts\demo-day.ps1

#

# Or:

#

# .\scripts\demo-day.ps1

#

# Options that send transactions use Sepolia or Hedera testnet.

$ErrorActionPreference = "Continue"

# Move to repository root

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Set-Location $RepoRoot

# -------------------------------------------------------------------

# Configuration

# -------------------------------------------------------------------

$RPC = "https://ethereum-sepolia-rpc.publicnode.com"

$REGISTRY = "0x2946B46c2EB5Ec532093877223Ef043b13729e39"

$SUBGRAPH = "https://api.studio.thegraph.com/query/1760047/executor/v0.1.2"

$GATEWAY = "https://executor-gateway.vercel.app"

$DEMO_AGENT = "0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37"

# -------------------------------------------------------------------

# Colors / formatting

# -------------------------------------------------------------------

function Write-HR {
Write-Host "────────────────────────────────────────────────────────────" `
-ForegroundColor DarkGray
}

function Write-Title {
param([string]$Text)

Write-Host $Text -ForegroundColor White

}

function Write-Dim {
param([string]$Text)

Write-Host $Text -ForegroundColor DarkGray

}

function Write-Green {
param([string]$Text)

Write-Host $Text -ForegroundColor Green

}

function Write-Yellow {
param([string]$Text)

Write-Host $Text -ForegroundColor Yellow

}

# -------------------------------------------------------------------

# Load .env files

#

# Simple KEY=VALUE parser.

# Never prints private keys.

# -------------------------------------------------------------------

function Import-EnvFile {
param([string]$Path)

if (-not (Test-Path $Path)) {
    return
}

Get-Content $Path | ForEach-Object {

    $line = $_.Trim()

    # Ignore comments and empty lines
    if (
        $line.Length -eq 0 -or
        $line.StartsWith("#")
    ) {
        return
    }

    # Split only at the first =
    $parts = $line -split "=", 2

    if ($parts.Count -ne 2) {
        return
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    # Remove surrounding quotes
    $value = $value.Trim('"')
    $value = $value.Trim("'")

    [Environment]::SetEnvironmentVariable(
        $key,
        $value,
        "Process"
    )
}

}

Import-EnvFile ".env"
Import-EnvFile ".env.local"

# -------------------------------------------------------------------

# Helper: HTTP status

# -------------------------------------------------------------------

function Get-HttpStatus {
param(
[string]$Url
)

try {

    $response = Invoke-WebRequest `
        -Uri $Url `
        -Method GET `
        -TimeoutSec 20 `
        -UseBasicParsing

    return $response.StatusCode

}
catch {

    if ($_.Exception.Response) {
        return [int]$_.Exception.Response.StatusCode
    }

    return "ERROR"
}

}

# -------------------------------------------------------------------

# 1 — Preflight

# -------------------------------------------------------------------

function Invoke-Preflight {

Write-HR
Write-Title "PREFLIGHT"
Write-HR

Write-Host -NoNewline "dashboard   "

Write-Host (
    Get-HttpStatus `
        "https://executor-dashboard.vercel.app"
)

Write-Host -NoNewline "gateway     "

Write-Host (
    Get-HttpStatus `
        "$GATEWAY/payto"
)

Write-Host -NoNewline "subgraph    "

try {

    $body = @{
        query = "{_meta{block{number} hasIndexingErrors}}"
    } | ConvertTo-Json -Compress

    $result = Invoke-RestMethod `
        -Uri $SUBGRAPH `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    $meta = $result.data._meta

    Write-Host (
        "block {0} errors {1}" -f `
        $meta.block.number,
        $meta.hasIndexingErrors
    )

}
catch {

    Write-Host "ERROR"
}

Write-Host -NoNewline "demo agent  "

try {

    $query = @{
        query = "{agent(id:`"$DEMO_AGENT`"){status heartbeatCount lastHeartbeat}}"
    } | ConvertTo-Json -Compress

    $result = Invoke-RestMethod `
        -Uri $SUBGRAPH `
        -Method POST `
        -ContentType "application/json" `
        -Body $query

    $agent = $result.data.agent

    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

    $age = $now - [int64]$agent.lastHeartbeat

    if ($age -lt 300) {
        $ok = "OK"
    }
    else {
        $ok = "STALE — restart the heartbeat (option 9)"
    }

    Write-Host (
        "{0} · {1} beats · {2}s ago · {3}" -f `
        $agent.status,
        $agent.heartbeatCount,
        $age,
        $ok
    )

}
catch {

    Write-Host "ERROR"
}

Write-HR

Write-Yellow "Before you record:"

Write-Host `
    "dismiss cookie banners on Etherscan and HashScan, and put your terminal font at ~16pt."

}

# -------------------------------------------------------------------

# 2 — Tabs

# -------------------------------------------------------------------

function Show-Tabs {

Write-HR
Write-Title "TABS TO OPEN"
Write-HR

Write-Host ""
Write-Title "Window A — the product"

Write-Host "  https://executor-dashboard.vercel.app"

Write-Host "  https://executor-dashboard.vercel.app/register"

Write-Host "  https://executor-dashboard.vercel.app/vitals"

Write-Host ""
Write-Title "Window B — evidence you do not own"

Write-Host `
    "  Etherscan · the USDC payment that landed in the TREASURY"

Write-Host `
    "    https://sepolia.etherscan.io/tx/0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5"

Write-Host ""
Write-Host `
    "  Etherscan · the same payer, same amount, into the ESTATE"

Write-Host `
    "    https://sepolia.etherscan.io/tx/0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad"

Write-Host ""
Write-Host `
    "  HashScan · option 3 prints a fresh link — prefer that over an old one"

Write-Host ""
Write-Host `
    "  Subgraph · https://thegraph.com/studio/subgraph/executor"

Write-Host ""

Write-Dim `
    "The two Etherscan transactions are from 10 Sep on purpose: they are agent 3's completed lifecycle, and a finished insolvency is the only kind that has a waterfall to show."

Write-Dim `
    "The Hedera payment should be fresh — use option 3."

}

# -------------------------------------------------------------------

# 3 — Real Hedera payment

# -------------------------------------------------------------------

function Invoke-Pay {

Write-HR
Write-Title "A REAL PAID REQUEST ON HEDERA"
Write-HR

Write-Dim `
    "402 → sign → pay 0.01 HBAR → a model answers. Costs 0.01 testnet HBAR."

$query = Read-Host `
    "Research query (Enter for default)"

if ([string]::IsNullOrWhiteSpace($query)) {

    $query = "What does a subgraph index?"

}

# Environment variables only apply to this process/session
$env:GATEWAY_URL = "$GATEWAY/research"

$env:RESEARCH_QUERY = $query

$logFile = Join-Path $env:TEMP "executor-pay.log"

# Execute pnpm and save output
pnpm --filter @executor/agent-debtor pay 2>&1 |

    Tee-Object -FilePath $logFile

# Find:
#
# transaction: '0.0.xxxx@...'
#
# or any value after transaction:
#

$content = Get-Content $logFile -Raw

$match = [regex]::Match(
    $content,
    "transaction:\s*'([^']+)'"
)

if ($match.Success) {

    $id = $match.Groups[1].Value

    Write-HR

    Write-Green `
        "Fresh HashScan link — open this on camera:"

    Write-Host `
        "  https://hashscan.io/testnet/transaction/$id"

}
else {

    Write-Yellow `
        "Could not automatically find the transaction ID in the output."

}

}

# -------------------------------------------------------------------

# 4 — Agent ID

# -------------------------------------------------------------------

function Get-AgentId {

$label = Read-Host `
    "Agent label (exactly as typed into the form)"

$id = cast keccak "$label"

Write-Green "agent id: $id"

Write-Dim `
    "This is how the page derives it: keccak256 of the label."

}

# -------------------------------------------------------------------

# 5 — Payment destination

# -------------------------------------------------------------------

function Get-Destination {

param(
    [string]$AgentId
)

if ([string]::IsNullOrWhiteSpace($AgentId)) {

    $AgentId = Read-Host "Agent ID"

}

Write-Host -NoNewline "destination: "

cast call `
    "$REGISTRY" `
    "getPaymentDestination(bytes32)(address)" `
    "$AgentId" `
    --rpc-url "$RPC"

Write-Dim `
    "0x7ea7f6e9…07330 = treasury   ·   0xDE3207F4…12337 = estate"

}

# -------------------------------------------------------------------

# 6 — Enter administration

# -------------------------------------------------------------------

function Invoke-Flip {

$AgentId = Read-Host "Agent ID"

Write-HR

Write-Title "enterAdministration — permissionless"

Write-Dim `
    "The caller holds none of the agent's four roles."

Write-Dim `
    "The contract checks the deadline, not the caller."

Write-HR

Get-Destination $AgentId

$privateKey = $env:PRIVATE_KEY

if ([string]::IsNullOrWhiteSpace($privateKey)) {

    Write-Host `
        "ERROR: PRIVATE_KEY not found in .env or .env.local" `
        -ForegroundColor Red

    return
}

cast send `
    "$REGISTRY" `
    "enterAdministration(bytes32)" `
    "$AgentId" `
    --rpc-url "$RPC" `
    --private-key "$privateKey"

Write-HR

Get-Destination $AgentId

}

# -------------------------------------------------------------------

# 7 — Restore active

# -------------------------------------------------------------------

function Invoke-Restore {

$AgentId = Read-Host "Agent ID"

$recoveryKey = $env:AGENT3_RECOVERY_KEY

if ([string]::IsNullOrWhiteSpace($recoveryKey)) {

    Write-Host `
        "ERROR: AGENT3_RECOVERY_KEY not found in .env or .env.local" `
        -ForegroundColor Red

    return
}

cast send `
    "$REGISTRY" `
    "restoreActive(bytes32)" `
    "$AgentId" `
    --rpc-url "$RPC" `
    --private-key "$recoveryKey"

Get-Destination $AgentId

}

# -------------------------------------------------------------------

# 8 — Query Subgraph

# -------------------------------------------------------------------

function Invoke-SubgraphQuery {

Write-HR

Write-Title `
    "THE GRAPH — approval and execution, joined by planHash"

Write-HR

$body = @{
    query = @"

{
planApprovals(orderBy:blockNumber) {
planHash
trustee
blockNumber
estate
}

planExecutions {
    planHash
    totalPaid
    shortfall
}

}
"@
} | ConvertTo-Json -Compress

try {

    $result = Invoke-RestMethod `
        -Uri $SUBGRAPH `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    $result | ConvertTo-Json -Depth 20

}
catch {

    Write-Host `
        "Subgraph query failed:" `
        -ForegroundColor Red

    Write-Host $_.Exception.Message
}

}

# -------------------------------------------------------------------

# 9 — Heartbeat runner

# -------------------------------------------------------------------

function Start-Heartbeat {

Write-HR

Write-Title `
    "RESTARTING THE HEARTBEAT RUNNER"

Write-Dim `
    "It dies with this PowerShell window. Leave this window open."

Write-HR

$signerKey = $env:AGENT3_SIGNER_KEY

if ([string]::IsNullOrWhiteSpace($signerKey)) {

    Write-Host `
        "ERROR: AGENT3_SIGNER_KEY not found in .env or .env.local" `
        -ForegroundColor Red

    return
}

$env:AGENT_ID = $DEMO_AGENT

$env:HEARTBEAT_SIGNER_KEY = $signerKey

$env:BEAT_SECONDS = "45"

# Your heartbeat script is currently Bash (.sh).
#
# OPTION A:
# If Git Bash is installed:
#
# bash ./scripts/heartbeat.sh
#
# OPTION B:
# Convert heartbeat.sh to heartbeat.ps1.

if (Get-Command bash -ErrorAction SilentlyContinue) {

    bash ./scripts/heartbeat.sh

}
else {

    Write-Host ""
    Write-Yellow `
        "Bash was not found."

    Write-Host `
        "Install Git for Windows / Git Bash, or convert heartbeat.sh to PowerShell."

}

}

# -------------------------------------------------------------------

# Menu

# -------------------------------------------------------------------

function Show-Menu {

Clear-Host

Write-Title "EXECUTOR — recording helper"

Write-Dim `
    "Options that send transactions say so. All testnet."

Write-HR

Write-Host "  1  Preflight — is everything live?"

Write-Host "  2  Tabs to open, and what each one is for"

Write-Host `
    "  3  Make a real paid request on Hedera   [sends 0.01 HBAR, prints a fresh HashScan link]"

Write-Host "  4  Work out an agent ID from its label"

Write-Host "  5  Read where an agent currently pays"

Write-Host `
    "  6  Flip an agent to administration      [sends a transaction]"

Write-Host `
    "  7  Restore an agent to active           [sends a transaction]"

Write-Host "  8  Query the subgraph"

Write-Host `
    "  9  Restart the heartbeat runner         [blocks this window — use a spare one]"

Write-Host "  q  Quit"

Write-HR

}

# -------------------------------------------------------------------

# Main loop

# -------------------------------------------------------------------

while ($true) {

Show-Menu

$choice = Read-Host ">"

switch ($choice) {

    "1" {

        Invoke-Preflight

    }

    "2" {

        Show-Tabs

    }

    "3" {

        Invoke-Pay

    }

    "4" {

        Get-AgentId

    }

    "5" {

        Get-Destination

    }

    "6" {

        Invoke-Flip

    }

    "7" {

        Invoke-Restore

    }

    "8" {

        Invoke-SubgraphQuery

    }

    "9" {

        Start-Heartbeat

    }

    "q" {

        exit 0

    }

    "Q" {

        exit 0

    }

    default {

        Write-Host "?"

    }
}

Write-Host ""

Read-Host "Press Enter to return to the menu"

}
