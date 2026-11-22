import { test, expect } from '@playwright/test';
import {
  acceptEmailInvite,
  createOrgInvitation,
  declineEmailInvite,
  getMe,
  upgradeToOrg,
} from './apiClient';
import { createTestUser, deleteTestUser, ensureServerUser } from './testUsers';

test.describe('2b-b email invitations', () => {
  test('verified user accepts to join; decline stays out', async () => {
    test.setTimeout(120_000);
    const owner = await createTestUser('2bb-owner');
    const invitee = await createTestUser('2bb-invitee');
    try {
      await ensureServerUser(owner.idToken);
      await ensureServerUser(invitee.idToken);

      const { json: upgraded } = await upgradeToOrg(owner.idToken, 'L2 2bb Org');
      expect(upgraded.success).toBe(true);
      const orgPublicId = upgraded.orgPublicId!;

      const { json: created } = await createOrgInvitation(owner.idToken, orgPublicId, {
        email: invitee.email,
        role: 'member',
      });
      expect(created.id).toBeTruthy();

      const { json: meBefore } = await getMe(invitee.idToken);
      expect(meBefore.pendingInvites?.length).toBeGreaterThan(0);
      const invitationId = meBefore.pendingInvites![0]!.invitationId;

      const { json: declinedTry } = await declineEmailInvite(invitee.idToken, invitationId);
      expect(declinedTry.success).toBe(true);

      const { json: meAfterDecline } = await getMe(invitee.idToken);
      expect(meAfterDecline.pendingInvites?.length ?? 0).toBe(0);
      expect(meAfterDecline.memberships?.some((m) => m.orgPublicId === orgPublicId)).toBeFalsy();

      const { json: created2 } = await createOrgInvitation(owner.idToken, orgPublicId, {
        email: invitee.email,
        role: 'member',
      });
      expect(created2.id).toBeTruthy();

      const { json: mePending } = await getMe(invitee.idToken);
      const invitationId2 = mePending.pendingInvites![0]!.invitationId;

      const { json: accepted } = await acceptEmailInvite(invitee.idToken, invitationId2);
      expect(accepted.success).toBe(true);

      const { json: meMember } = await getMe(invitee.idToken);
      expect(
        meMember.memberships?.some((m) => m.orgPublicId === orgPublicId && m.role === 'member')
      ).toBe(true);
    } finally {
      await deleteTestUser(owner);
      await deleteTestUser(invitee);
    }
  });
});