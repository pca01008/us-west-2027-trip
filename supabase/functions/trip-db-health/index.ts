import { createHealthHandler } from './handler.mjs';

Deno.serve(createHealthHandler({ env: (name: string) => Deno.env.get(name) }));
