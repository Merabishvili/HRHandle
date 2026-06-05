export const SESSION_REMEMBER_KEY = 'hrhandle_remember_me'
export const SESSION_LAST_ACTIVE_KEY = 'hrhandle_last_active'

export function setSessionPreference(rememberMe: boolean) {
  localStorage.setItem(SESSION_REMEMBER_KEY, rememberMe ? 'true' : 'false')
  if (!rememberMe) {
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, Date.now().toString())
  } else {
    localStorage.removeItem(SESSION_LAST_ACTIVE_KEY)
  }
}

export function clearSessionTracking() {
  localStorage.removeItem(SESSION_LAST_ACTIVE_KEY)
}
