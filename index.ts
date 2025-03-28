#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import process from "process";
import axios from "axios";

import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const logger = {
    info: (...args: any[]) => console.error('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    warn: (...args: any[]) => console.error('[WARN]', ...args),
    debug: (...args: any[]) => console.error('[DEBUG]', ...args)
};

interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
}

interface HandlerDefinition {
    handler: Function;
}

const getTickerOhlcvDefinition: ToolDefinition = {
    name: "get_ticker_ohlcv",
    description: "Get specific ticker OHLCV data (Open, High, Low, Close, Volume)",
    inputSchema: {
        type: "object",
        properties: {
            ticker: {
                type: "string",
                description: "The ticker symbol to get the price for (e.g. AAPL)"
            },
            infoType: {
                type: "string",
                enum: ["open", "close", "high", "low", "volume"],
                description: "The type of ticker information to get (open, close, high, low, volume)"
            },
            date: {
                type: "string",
                description: "The date for which to get the OHLCV data (YYYY-MM-DD)",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
            }
        },
        required: ["ticker", "infoType", "date"]
    }
};

const getTickerDividendDefinition: ToolDefinition = {
    name: "get_ticker_dividend",
    description: "Get dividend data for a specific ticker",
    inputSchema: {
        type: "object",
        properties: {
            ticker: {
                type: "string",
                description: "The ticker symbol to get the dividend data for (e.g. AAPL)"
            }
        },
        required: ["ticker"]
    }
};

const getEtfHoldingsDefinition: ToolDefinition = {
    name: "get_etf_holdings",
    description: "Get the holdings data for a specific ETF",
    inputSchema: {
        type: "object",
        properties: {
            ticker: {
                type: "string",
                description: "The ticker symbol of the ETF (e.g. SPY)"
            }
        },
        required: ["ticker"]
    }
};

const getExchangeRateDefinition: ToolDefinition = {
    name: "get_exchange_rate",
    description: "Get the exchange rate between two currencies (fiat or crypto)",
    inputSchema: {
        type: "object",
        properties: {
            fromCurrency: {
                type: "string",
                description: "The currency to convert from (e.g. USD, BTC)"
            },
            toCurrency: {
                type: "string",
                description: "The currency to convert to (e.g. EUR, ETH)"
            }
        },
        required: ["fromCurrency", "toCurrency"]
    }
};

const toolDefinitions: { [key: string]: ToolDefinition } = {
    [getTickerOhlcvDefinition.name]: getTickerOhlcvDefinition,
    [getTickerDividendDefinition.name]: getTickerDividendDefinition,
    [getEtfHoldingsDefinition.name]: getEtfHoldingsDefinition,
    [getExchangeRateDefinition.name]: getExchangeRateDefinition,
};

const server = new Server({
    name: "alpha_vantage",
    version: "0.1.0"
}, {
    capabilities: {
        tools: toolDefinitions,
    }
});

const listToolsHandler: HandlerDefinition = {
    handler: async () => ({
        tools: [
            {
                name: "get_ticker_ohlcv",
                description: "Get specific ticker OHLCV data (Open, High, Low, Close, Volume)",
                inputSchema: zodToJsonSchema(
                    z.object({
                        ticker: z.string().describe("The ticker symbol to get the price for (e.g. AAPL)"),
                        infoType: z.enum(["open", "close", "high", "low", "volume"]).describe("The type of ticker information to get (open, close, high, low, volume)"),
                        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("The date for which to get the OHLCV data (YYYY-MM-DD)"),
                    })
                ),
            },
            {
                name: "get_ticker_dividend",
                description: "Get dividend data for a specific ticker",
                inputSchema: zodToJsonSchema(
                    z.object({
                        ticker: z.string().describe("The ticker symbol of the ETF (e.g. AAPL)"),
                    })
                ),
            },
            {
                name: "get_etf_holdings",
                description: "Get the holdings data for a specific ETF",
                inputSchema: zodToJsonSchema(
                    z.object({
                        ticker: z.string().describe("The ticker symbol of the ETF (e.g. SPY)"),
                    })
                ),
            },
            {
                name: "get_exchange_rate",
                description: "Get the exchange rate between two currencies (fiat or crypto)",
                inputSchema: zodToJsonSchema(
                    z.object({
                        fromCurrency: z.string().describe("The currency to convert from (e.g. USD, BTC)"),
                        toCurrency: z.string().describe("The currency to convert to (e.g. EUR, ETH)"),
                    })
                ),
            },
        ],
    })
};

async function handleGetTickerOhlcv(req: any, apiKey: string) {
    const { ticker, infoType, date } = req.params.arguments as { ticker: string; infoType: "open" | "close" | "high" | "low" | "volume"; date: string };

    try {
        let response: any;
        try {
            response = await axios.get(
                `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${apiKey}`
            );
        } catch (e: any) {
            logger.error(e);
            throw new Error(e);
        }

        let actualDate = date;
        if (actualDate === "") {
            actualDate = Object.keys(response.data["Time Series (Daily)"])[0];
        }

        const ohlcv = response.data["Time Series (Daily)"][actualDate];

        if (!ohlcv) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No data found for ${ticker} on ${actualDate}.`,
                    },
                ],
                isError: true,
            };
        }

        const openPrice = ohlcv["1. open"];
        const highPrice = ohlcv["2. high"];
        const lowPrice = ohlcv["3. low"];
        const closePrice = ohlcv["4. close"];
        const volume = ohlcv["5. volume"];

        let price;
        switch (infoType) {
            case "open":
                price = openPrice;
                break;
            case "high":
                price = highPrice;
                break;
            case "low":
                price = lowPrice;
                break;
            case "close":
                price = closePrice;
                break;
            case "volume":
                price = volume;
                break;
            default:
                throw new Error(`Invalid infoType: ${infoType}`);
        }

        return {
            content: [
                {
                    type: "text",
                    text: `The ${infoType} for ${ticker} on ${actualDate} is ${price}`,
                },
            ],
        };
    } catch (error: any) {
        logger.error(error);
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get the ${infoType} price for ${ticker}. Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
}

async function handleGetTickerDividend(req: any, apiKey: string) {
    const { ticker } = req.params.arguments as { ticker: string };

    try {
        let response: any;
        try {
            response = await axios.get(
                `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${ticker}&apikey=${apiKey}`
            );
        } catch (e: any) {
            logger.error(e);
            throw new Error(e);
        }

        const dividendHistory = response.data["data"];
        if (!dividendHistory) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No dividend data found for ${ticker}.`,
                    },
                ],
                isError: true,
            };
        }

        const dividends = dividendHistory.map(item => {
            return `Ex-Dividend Date: ${item.ex_dividend_date}, Amount: ${item.amount}`;
        }).join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `Dividend history for ${ticker}:\n${dividends}`,
                },
            ],
        };
    } catch (error: any) {
        logger.error(error);
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get the dividend data for ${ticker}. Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
}

async function handleGetEtfHoldings(req: any, apiKey: string) {
    const { ticker } = req.params.arguments as { ticker: string };

    try {
        let response: any;
        try {
            response = await axios.get(
                `https://www.alphavantage.co/query?function=ETF_PROFILE&symbol=${ticker}&apikey=${apiKey}`
            );
        } catch (e: any) {
            logger.error(e);
            throw new Error(e);
        }

        const holdingsData = response.data["holdings"];

        if (!holdingsData) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No holdings data found for ${ticker}.`,
                    },
                ],
                isError: true,
            };
        }

        const holdings = holdingsData.map(item => {
            return `Holding: ${item.description} (${item.symbol}), Weight: ${item.weight}`;
        }).join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `Holdings for ${ticker}:\n${holdings}`,
                },
            ],
        };
    } catch (error: any) {
        logger.error(error);
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get the holdings data for ${ticker}. Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
}

async function handleGetExchangeRate(req: any, apiKey: string) {
    const { fromCurrency, toCurrency } = req.params.arguments as { fromCurrency: string; toCurrency: string };

    try {
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${apiKey}`
        );

        const priceData = response.data["Realtime Currency Exchange Rate"];

        if (!priceData) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Could not retrieve exchange rate for ${fromCurrency} to ${toCurrency}.`,
                    },
                ],
                isError: true,
            };
        }

        const exchangeRate = priceData["5. Exchange Rate"];

        return {
            content: [
                {
                    type: "text",
                    text: `The exchange rate from ${fromCurrency} to ${toCurrency} is ${exchangeRate}`,
                },
            ],
        };
    } catch (error: any) {
        logger.error(error);
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get the exchange rate for ${fromCurrency} to ${toCurrency}. Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
}

const callToolHandler: HandlerDefinition = {
    handler: async (req: any) => {
        const apiKey = process.env.ALPHAVANTAGE_API_KEY;

        if (!apiKey) {
            throw new Error("ALPHAVANTAGE_API_KEY is not set");
        }

        switch (req.params.name) {
            case "get_ticker_ohlcv":
                return await handleGetTickerOhlcv(req, apiKey);
            case "get_ticker_dividend":
                return await handleGetTickerDividend(req, apiKey);
            case "get_etf_holdings":
                return await handleGetEtfHoldings(req, apiKey);
            case "get_exchange_rate":
                return await handleGetExchangeRate(req, apiKey);
            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: `Tool ${req.params.name} not found.`,
                        },
                    ],
                    isError: true,
                };
        }
    }
};

server.setRequestHandler(ListToolsRequestSchema, async () => (await listToolsHandler.handler()));
server.setRequestHandler(CallToolRequestSchema, async (req) => await callToolHandler.handler(req));

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport)
}

main().catch((error) => {
    logger.error("Server error: ", error);
    process.exit(1);
})
