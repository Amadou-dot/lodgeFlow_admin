/** One-time migration. Dry run by default; existing assignments are never overwritten. */
import connectDB from '../src/mongodb';
import StaffAccess from '../src/models/StaffAccess';
import mongoose from 'mongoose';

async function main() {
  const organizationId = process.env.LODGEFLOW_STAFF_ORG_ID;
  const secret = process.env.CLERK_SECRET_KEY;
  if (!organizationId || !secret)
    throw new Error('Staff organization and Clerk credentials are required');
  const administrators: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${encodeURIComponent(organizationId)}/memberships?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    if (!response.ok)
      throw new Error(`Clerk membership request failed (${response.status})`);
    const result = await response.json();
    for (const member of result.data) {
      if (member.role === 'org:admin' && member.public_user_data?.user_id)
        administrators.push(member.public_user_data.user_id);
    }
    if (
      offset + result.data.length >= result.total_count ||
      !result.data.length
    )
      break;
  }
  if (!administrators.length)
    throw new Error(
      'No existing organization administrators; migration stopped'
    );
  await connectDB();
  await StaffAccess.init();
  const existing = await StaffAccess.countDocuments({ organizationId });
  if (existing) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: 'Staff assignments already exist',
        assignments: existing,
      })
    );
    return;
  }
  const apply = process.argv.includes('--apply');
  if (apply) {
    await StaffAccess.insertMany(
      administrators.map(userId => ({
        organizationId,
        userId,
        role: 'admin',
        updatedBy: 'migration:existing-clerk-admin',
      }))
    );
  }
  console.log(
    JSON.stringify({
      applied: apply,
      administratorCount: administrators.length,
    })
  );
}
main()
  .catch(() => {
    console.error(
      'Staff bootstrap failed; credentials and membership details omitted'
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
