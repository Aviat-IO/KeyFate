declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique identifier. */
      id: string
      /** The user's name. */
      name?: string | null
      /** The user's email address. */
      email?: string | null
      /** The user's profile image. */
      image?: string | null
    }
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User {
    /** The user's unique identifier. */
    id: string
    /** The user's name. */
    name?: string | null
    /** The user's email address. */
    email?: string | null
    /** The user's profile image. */
    image?: string | null
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's unique identifier. */
    id?: string
    /** The access token returned by the OAuth provider. */
    accessToken?: string
  }
}