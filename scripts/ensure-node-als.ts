import { AsyncLocalStorage } from "node:async_hooks";

/** Next reads global AsyncLocalStorage. Node exposes that class from async_hooks. */

const host = globalThis as typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage };
if (!host.AsyncLocalStorage) host.AsyncLocalStorage = AsyncLocalStorage;
