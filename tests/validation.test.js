import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidWebsiteUrl, isValidAndroidId, isValidIosBundleId } from '../src/validation.js';

test('accepts HTTP and HTTPS website URLs', () => {
  assert.equal(isValidWebsiteUrl('https://example.com'), true);
  assert.equal(isValidWebsiteUrl('http://sub.example.org/path'), true);
});

test('rejects malformed and unsupported URLs', () => {
  assert.equal(isValidWebsiteUrl('example.com'), false);
  assert.equal(isValidWebsiteUrl('javascript:alert(1)'), false);
  assert.equal(isValidWebsiteUrl('file:///etc/passwd'), false);
  assert.equal(isValidWebsiteUrl(''), false);
});

test('validates Android package IDs', () => {
  assert.equal(isValidAndroidId('com.example.myapp'), true);
  assert.equal(isValidAndroidId('com.my_app.mobile'), true);
  assert.equal(isValidAndroidId('myapp'), false);
  assert.equal(isValidAndroidId('com..app'), false);
});

test('validates iOS bundle IDs', () => {
  assert.equal(isValidIosBundleId('com.example.myapp'), true);
  assert.equal(isValidIosBundleId('com.example-app.mobile'), true);
  assert.equal(isValidIosBundleId('com'), false);
  assert.equal(isValidIosBundleId('com..app'), false);
});
