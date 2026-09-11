import {
  db,
  credentials,
  eq,
  and,
  sql,
  type Credential,
} from '@nodex/db';

export async function findCredential(
  ownerId: string,
  provider: string
): Promise<Credential | null> {
  const [cred] = await db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.ownerId, ownerId),
        eq(credentials.provider, provider)
      )
    )
    .limit(1);

  return cred || null;
}

export async function saveCredential(
  ownerId: string,
  provider: string,
  encryptedData: string,
  keyVersion: number = 1
): Promise<Credential> {
  const existing = await findCredential(ownerId, provider);

  if (existing) {
    const [updated] = await db
      .update(credentials)
      .set({
        encryptedData,
        keyVersion,
        updatedAt: sql`NOW()`,
      })
      .where(eq(credentials.id, existing.id))
      .returning();

    return updated;
  }

  const [inserted] = await db
    .insert(credentials)
    .values({
      ownerId,
      provider,
      encryptedData,
      keyVersion,
    })
    .returning();

  return inserted;
}

export async function deleteCredential(
  ownerId: string,
  provider: string
): Promise<boolean> {
  const deleted = await db
    .delete(credentials)
    .where(
      and(
        eq(credentials.ownerId, ownerId),
        eq(credentials.provider, provider)
      )
    )
    .returning({ id: credentials.id });

  return deleted.length > 0;
}

export async function listCredentialsByOwner(
  ownerId: string
): Promise<Array<Omit<Credential, 'encryptedData'>>> {
  const rows = await db
    .select({
      id: credentials.id,
      ownerId: credentials.ownerId,
      provider: credentials.provider,
      keyVersion: credentials.keyVersion,
      createdAt: credentials.createdAt,
      updatedAt: credentials.updatedAt,
    })
    .from(credentials)
    .where(eq(credentials.ownerId, ownerId));

  return rows;
}
