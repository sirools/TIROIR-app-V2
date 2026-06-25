// // apps/next/mocks/supabase.web.ts
// export const supabase = {
//   auth: {
//     getSession: async () => ({ data: null }),
//     signOut: async () => ({ error: null }),
//   },
// }


// apps/next/mocks/supabase.web.ts
export const createClient = (..._args: any[]) => {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({ data: null, error: null }),
    }),
    // ajoute ce qu’il faut au besoin
  }
}