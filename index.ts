#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import axios from "axios";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import process from "process";


import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const logger = {
    info: (...args: any[]) => console.error('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    warn: (...args: any[]) => console.error('[WARN]', ...args),
    debug: (...args: any[]) => console.error('[DEBUG]', ...args)
};

const server = new Server({
    name: "alpha_vantage",
    version: "0.1.0"
}, {
    capabilities: {
        tools: {
            get_ticker_ohlcv: {
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
            }
        },
    }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
    ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { ticker, infoType, date } = req.params.arguments as { ticker: string; infoType: "open" | "close" | "high" | "low" | "volume"; date: string };
    const apiKey = process.env.ALPHAVANTAGE_API_KEY;

    if (!apiKey) {
        throw new Error("ALPHAVANTAGE_API_KEY is not set");
    }

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
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport)
}

main().catch((error) => {
    logger.error("Server error: ", error);
    process.exit(1);
})
