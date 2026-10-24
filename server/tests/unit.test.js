import test from 'node:test';
import assert from 'node:assert/strict';
import { canDonationTransition, canRequestTransition, canPickupTransition, deriveDonationStatus } from '../src/utils/statusMachine.js';
import { sniffImage } from '../src/utils/image.js';
import { toKg } from '../src/utils/units.js';
import { sha256, safeEqual } from '../src/utils/security.js';
import { addDays, zonedToUtc, zonedParts } from '../src/utils/time.js';

test('donation cannot jump from available to delivered', () => {
  assert.equal(canDonationTransition('available', 'delivered'), false);
  assert.equal(canDonationTransition('available', 'request_pending'), true);
  assert.equal(canDonationTransition('completed', 'available'), false);
  assert.equal(canDonationTransition('expired', 'available'), false);
});
test('request transitions are enforced', () => {
  assert.equal(canRequestTransition('pending', 'accepted'), true);
  assert.equal(canRequestTransition('pending', 'completed'), false);
  assert.equal(canRequestTransition('rejected', 'accepted'), false);
  assert.equal(canRequestTransition('delivered', 'completed'), true);
});
test('pickup follows Assigned → Accepted → En Route → Picked Up → Delivered → Completed', () => {
  const chain = ['assigned', 'accepted', 'en_route', 'picked_up', 'delivered', 'completed'];
  for (let i = 0; i < chain.length - 1; i++) assert.equal(canPickupTransition(chain[i], chain[i + 1]), true, chain[i]);
  assert.equal(canPickupTransition('accepted', 'picked_up'), false);
  assert.equal(canPickupTransition('completed', 'accepted'), false);
});
test('deriveDonationStatus handles partial and full allocation', () => {
  const d = { quantity: 10, quantityReserved: 4 };
  assert.equal(deriveDonationStatus(d, [{ status: 'accepted' }]), 'available');
  assert.equal(deriveDonationStatus(d, [{ status: 'accepted' }, { status: 'pending' }]), 'request_pending');
  const full = { quantity: 10, quantityReserved: 10 };
  assert.equal(deriveDonationStatus(full, [{ status: 'accepted' }]), 'reserved');
  assert.equal(deriveDonationStatus(full, [{ status: 'ready_for_pickup' }]), 'ready_for_pickup');
  assert.equal(deriveDonationStatus(full, [{ status: 'picked_up' }, { status: 'accepted' }]), 'reserved');
  assert.equal(deriveDonationStatus(full, [{ status: 'completed' }]), 'completed');
});
test('image sniffing checks real bytes, not names', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
  assert.equal(sniffImage(jpeg), 'image/jpeg');
  assert.equal(sniffImage(Buffer.from('<?php echo 1; ?> not an image at all')), null);
});
test('toKg converts only mass units', () => {
  assert.equal(toKg('kg', 2), 2); assert.equal(toKg('g', 500), 0.5); assert.equal(toKg('portions', 10), null);
});
test('token hashing and constant-time compare', () => {
  assert.notEqual(sha256('abc'), 'abc'); assert.equal(safeEqual('a', 'a'), true); assert.equal(safeEqual('a', 'b'), false); assert.equal(safeEqual(undefined, 'b'), false);
});
test('time zone helpers', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  const utc = zonedToUtc('2026-07-01', '09:00', 'Asia/Kolkata'); // UTC+5:30, no DST
  assert.equal(utc.toISOString(), '2026-07-01T03:30:00.000Z');
  assert.equal(zonedParts(utc, 'Asia/Kolkata').ymd, '2026-07-01');
});
