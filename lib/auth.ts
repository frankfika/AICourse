import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId: string
  username: string
  email: string
  name: string
  role: string
  isLoggedIn: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'courseai_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions)
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session.isLoggedIn === true
}

export async function requireAuth() {
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    throw new Error('Unauthorized')
  }
}

