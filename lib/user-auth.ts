import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface UserSessionData {
  userId: string
  email: string
  name: string
  avatar?: string
  isLoggedIn: boolean
}

const userSessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'courseai_user_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getUserSession(): Promise<IronSession<UserSessionData>> {
  const cookieStore = await cookies()
  return getIronSession<UserSessionData>(cookieStore, userSessionOptions)
}

export async function isUserAuthenticated(): Promise<boolean> {
  const session = await getUserSession()
  return session.isLoggedIn === true
}

export async function requireUserAuth() {
  const authenticated = await isUserAuthenticated()
  if (!authenticated) {
    throw new Error('请先登录')
  }
}

export async function getCurrentUser() {
  const session = await getUserSession()
  if (!session.isLoggedIn) {
    return null
  }
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    avatar: session.avatar,
  }
}
