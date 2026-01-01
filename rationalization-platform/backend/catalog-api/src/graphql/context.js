/**
 * GraphQL Context
 * Provides database connections and utilities to resolvers
 */

export async function createContext({ req, db }) {
  return {
    db,
    req,
    user: req.user || null, // If authentication is implemented
  };
}
