import {
  db,
  users,
  eq,
  type User,
  type NewUser,
} from '@nodex/db';

export async function findUserById(id: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id));
  return user || null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()));
  return user || null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleId));
  return user || null;
}

export async function createUser(user: NewUser): Promise<User> {
  const [created] = await db
    .insert(users)
    .values({
      ...user,
      email: user.email.toLowerCase().trim(),
    })
    .returning();
  return created;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  const [updated] = await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  return updated;
}

export async function upsertGoogleUser(profile: {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}): Promise<User> {
  const normalizedEmail = profile.email.toLowerCase().trim();

  // 1. Check if user exists by googleId
  const byGoogle = await findUserByGoogleId(profile.googleId);
  if (byGoogle) {
    return updateUser(byGoogle.id, {
      name: profile.name || byGoogle.name,
      avatarUrl: profile.avatarUrl || byGoogle.avatarUrl,
    });
  }

  // 2. Check if user exists by email (link Google account to existing email)
  const byEmail = await findUserByEmail(normalizedEmail);
  if (byEmail) {
    return updateUser(byEmail.id, {
      googleId: profile.googleId,
      name: profile.name || byEmail.name,
      avatarUrl: profile.avatarUrl || byEmail.avatarUrl,
      authProvider: byEmail.authProvider === 'local' ? 'google' : byEmail.authProvider,
    });
  }

  // 3. Create new user for this Google account
  return createUser({
    email: normalizedEmail,
    googleId: profile.googleId,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    authProvider: 'google',
    role: 'user',
  });
}
