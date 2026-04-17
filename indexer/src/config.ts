import { z } from "zod";
import "dotenv/config";

const EnvSchema = z.object({
  RISE_RPC: z.string().url(),
  FACTORY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ORDERBOOK_FACTORY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  DATABASE_URL: z.string().min(10),
  PORT: z.coerce.number().int().min(1).max(65535).default(4090),
});

export type Config = z.infer<typeof EnvSchema> & {
  FACTORY_ADDRESS: `0x${string}`;
  ORDERBOOK_FACTORY_ADDRESS?: `0x${string}`;
};

export function loadConfig(): Config {
  const parsed = EnvSchema.parse(process.env);
  return {
    ...parsed,
    FACTORY_ADDRESS: parsed.FACTORY_ADDRESS as `0x${string}`,
    ORDERBOOK_FACTORY_ADDRESS: parsed.ORDERBOOK_FACTORY_ADDRESS as `0x${string}` | undefined,
  };
}

