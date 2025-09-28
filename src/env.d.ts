
interface ImportMetaEnv {
  readonly VITE_SUBSCRIBE_URL?: string
  readonly VITE_SUBSCRIBE_PERSONAL_URL?: string
  readonly VITE_SUBSCRIBE_FREELANCER_URL?: string
  readonly VITE_CONSULT_URL?: string
  readonly VITE_PORTAL_URL?: string
  readonly VITE_HF_TOKEN?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
