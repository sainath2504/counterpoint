declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    COUNTERPOINT_LOCAL_DEMO?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  }
}
