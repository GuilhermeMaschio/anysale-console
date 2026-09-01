import Keycloak from 'keycloak-js'

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8180',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'anysale-realm',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'anysale-console',
})

let initialization: Promise<void> | undefined

export async function initializeAuth() {
  initialization ??= keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  }).then(() => undefined)
  await initialization
}

export async function accessToken() {
  if (!keycloak.authenticated) throw new Error('Sua sessão expirou. Entre novamente.')
  await keycloak.updateToken(30)
  if (!keycloak.token) throw new Error('Não foi possível obter o token de acesso.')
  return keycloak.token
}

export function signIn() {
  return keycloak.login()
}

export function signOut() {
  return keycloak.logout({ redirectUri: window.location.origin })
}

export function currentUserName(): string {
  const token = keycloak.tokenParsed
  const name = token?.name ?? token?.preferred_username
  return typeof name === 'string' && name.trim() ? name : 'Operador'
}

export function isAdministrator(): boolean {
  return hasRole('ADMIN')
}

export function canManageCadences(): boolean {
  return hasRole('ADMIN') || hasRole('SALES_MANAGER')
}

function hasRole(expectedRole: string): boolean {
  const token = keycloak.tokenParsed as { realm_access?: { roles?: unknown }, resource_access?: Record<string, { roles?: unknown }> } | undefined
  const realmRoles = Array.isArray(token?.realm_access?.roles) ? token.realm_access.roles : []
  const clientRoles = Array.isArray(token?.resource_access?.['anysale-console']?.roles) ? token.resource_access['anysale-console'].roles : []
  return [...realmRoles, ...clientRoles].some((role) => typeof role === 'string' && role.toUpperCase() === expectedRole)
}

export default keycloak
