export function isMissingRpc(error: { message?: string; code?: string } | null, name: string) {
  if (!error) return false;
  return error.code === "PGRST202"
    || error.message?.includes("Could not find the function")
    || error.message?.includes(name);
}
