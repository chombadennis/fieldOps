# ==============================================================================
# Crypto Data Extraction (CDE) Script
# Purpose: Fetch current price and 24h market metrics for Bitcoin and Ethereum
# Requirements: Python 3.x, `requests` library
# ==============================================================================

import requests
import json
import sys
from datetime import datetime

def fetch_crypto_data(coin_ids=["bitcoin", "ethereum"]):
    """
    Fetches real-time price and volume data from the CoinGecko Public API.
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Initializing CDE engine...")
    
    # Target endpoint for simple price lookup with metrics
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {
        "ids": ",".join(coin_ids),
        "vs_currencies": "usd",
        "include_market_cap": "true",
        "include_24hr_vol": "true",
        "include_24hr_change": "true"
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error executing CDE data fetch: {e}", file=sys.stderr)
        return None

def parse_and_display(data):
    """
    Parses the JSON response and structures it into a scannability-optimized log.
    """
    if not data:
        print("No data extracted.")
        return

    print("\n==========================================")
    print("        CRYPTO EXTRACTED METRICS         ")
    print("==========================================\n")
    
    for asset, metrics in data.items():
        name = asset.upper()
        price = metrics.get("usd", 0)
        cap = metrics.get("usd_market_cap", 0)
        vol = metrics.get("usd_24h_vol", 0)
        change = metrics.get("usd_24h_change", 0)
        
        print(f"🔹 ASSET: {name}")
        print(f"  - Current Price:    ${price:,.2f}")
        print(f"  - 24h Price Change: {change:+.2f}%")
        print(f"  - Market Cap:       ${cap:,.0f}")
        print(f"  - 24h Volume:       ${vol:,.0f}")
        print("-" * 42)

if __name__ == "__main__":
    extracted_data = fetch_crypto_data()
    parse_and_display(extracted_data)
