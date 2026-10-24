/** `node --import ./test/fake-sdk/register.ts …` resolves `@typesafe-ai/sdk` to ./sdk.ts. */
import { registerHooks } from 'node:module';

const FAKE = new URL('./sdk.ts', import.meta.url).href;

registerHooks({
  resolve: (specifier, context, next) =>
    specifier === '@typesafe-ai/sdk' ? { url: FAKE, shortCircuit: true } : next(specifier, context),
});
