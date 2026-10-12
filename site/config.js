/* Delidome settings. The two values below are SAFE to publish:
   the anon key only lets visitors call the public shop functions
   (everything else is locked by the database; see supabase/migrations).
   Leave both empty to run in DEMO mode (data stays in this browser only). */
window.DELIDOME_CONFIG = {
  supabaseUrl: "",      // e.g. "https://abcdxyz.supabase.co"
  supabaseAnonKey: ""   // Project Settings > API > "anon" / "publishable" key
};
