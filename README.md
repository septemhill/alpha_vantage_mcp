# Alpha Vantage MCP Server

This MCP server provides access to financial data from Alpha Vantage. It includes tools to retrieve OHLCV data, dividend data, and ETF holdings.

## Tools

### get_ticker_ohlcv

Get specific ticker OHLCV data (Open, High, Low, Close, Volume) for a given date.

**Input:**

```json
{
  "ticker": "AAPL",
  "infoType": "close",
  "date": "2024-01-02"
}
```

**Example Usage:**

To get the closing price of AAPL on January 2, 2024:

```bash
mcp call alpha_vantage get_ticker_ohlcv '{"ticker": "AAPL", "infoType": "close", "date": "2024-01-02"}'
```

### get_ticker_dividend

Get dividend data for a specific ticker.

**Input:**

```json
{
  "ticker": "AAPL"
}
```

**Example Usage:**

To get the dividend data for AAPL:

```bash
mcp call alpha_vantage get_ticker_dividend '{"ticker": "AAPL"}'
```

### get_etf_holdings

Get the holdings data for a specific ETF.

**Input:**

```json
{
  "ticker": "SPY"
}
```

**Example Usage:**

To get the holdings data for SPY:

```bash
mcp call alpha_vantage get_etf_holdings '{"ticker": "SPY"}'
```

## Configuration

The server requires an Alpha Vantage API key to be set in the environment variable `ALPHAVANTAGE_API_KEY`.
