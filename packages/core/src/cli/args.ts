/** CLI arguments without the `--` separator that pnpm forwards (`pnpm script -- --flag`). */
export function cliArgs(): string[] {
  const args = process.argv.slice(2)
  return args[0] === '--' ? args.slice(1) : args
}
