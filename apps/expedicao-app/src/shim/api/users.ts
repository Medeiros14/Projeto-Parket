import { currentUserId } from "./helpers";
import { getAuthState } from "../auth-store";

export const updateCurrentUser = async () => currentUserId();

export const getCurrentUser = async () => {
  const s = getAuthState();
  const u = s.session?.user;
  if (!u) return null;
  return {
    _id: u.id,
    _creationTime: Date.now(),
    tokenIdentifier: u.id,
    name: (u.user_metadata?.name as string) ?? u.email?.split("@")[0],
    email: u.email,
  };
};
