import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { adminPermissionForRoute } from "../shared/admin-security";
import { registerAdminStaffRoutes, staffEmailExists, staffUserInput } from "../shared/admin-staff-routes";

function staffRoutes(results: Array<any[] | Error>) {
  const handlers: Record<string, (req: any, res: any) => Promise<void>> = {};
  const app = {
    get: (_path: string, handler: (req: any, res: any) => Promise<void>) => { handlers.get = handler; },
    post: (_path: string, handler: (req: any, res: any) => Promise<void>) => { handlers.post = handler; },
  } as unknown as Express;
  let calls = 0;
  const db = {
    execute: async () => {
      const result = results[calls++];
      if (result instanceof Error) throw result;
      return result ?? [];
    },
    transaction: async <T,>(callback: (tx: any) => Promise<T>): Promise<T> => callback(db),
  };
  registerAdminStaffRoutes(app, () => db);
  const response = () => {
    const res = {
      code: 200,
      body: undefined as any,
      status(value: number) { this.code = value; return this; },
      json(value: any) { this.body = value; return this; },
    };
    return res;
  };
  return { handlers, response, get calls() { return calls; }, db };
}

test("staff accounts are separate and staff routes require super-admin access even for reads", () => {
  assert.equal(adminPermissionForRoute("/api/admin/staff-users", "GET"), "super");
  assert.equal(adminPermissionForRoute("/api/admin/staff-users", "POST"), "super");
  assert.deepEqual(staffUserInput.parse({ name: "  Example Staff ", email: " STAFF@Example.com " }), {
    name: "Example Staff", email: "staff@example.com",
  });
  assert.equal(staffUserInput.safeParse({ name: "A", email: "x@y.co", isSuperAdmin: true }).success, false);
  assert.equal(staffUserInput.safeParse({ name: "  ", email: "x@y.co" }).success, false);
});

test("staff listing and addition return only staff records, without administrator roles", async () => {
  const person = { id: "staff-1", name: "Example Staff", email: "staff@example.com", status: "pending_access", createdAt: "2026-09-23" };
  const list = staffRoutes([[person]]);
  const listed = list.response();
  await list.handlers.get({}, listed);
  assert.deepEqual(listed.body, [person]);

  const create = staffRoutes([[], [], [person]]);
  const added = create.response();
  await create.handlers.post({ body: { name: " Example Staff ", email: " STAFF@Example.com " } }, added);
  assert.equal(added.code, 201);
  assert.deepEqual(added.body, person);
  assert.equal(create.calls, 3);
});

test("staff addition rejects invalid input, existing admins, and duplicate staff emails", async () => {
  const bad = staffRoutes([]);
  const rejected = bad.response();
  await bad.handlers.post({ body: { name: "Test", email: "not-an-email" } }, rejected);
  assert.equal(rejected.code, 400);
  assert.equal(bad.calls, 0);

  const existingAdmin = staffRoutes([[], [{ id: "admin-1" }]]);
  const conflict = existingAdmin.response();
  await existingAdmin.handlers.post({ body: { name: "Test", email: "test@example.com" } }, conflict);
  assert.equal(conflict.code, 409);
  assert.equal(existingAdmin.calls, 2);

  const duplicate = staffRoutes([[], [], Object.assign(new Error("duplicate"), { code: "23505" })]);
  const duplicateResponse = duplicate.response();
  await duplicate.handlers.post({ body: { name: "Test", email: "test@example.com" } }, duplicateResponse);
  assert.equal(duplicateResponse.code, 409);
});

test("admin creation can detect staff emails with either PostgreSQL result shape", async () => {
  assert.equal(await staffEmailExists({ execute: async () => [{ id: "staff-1" }] }, "STAFF@example.com"), true);
  assert.equal(await staffEmailExists({ execute: async () => ({ rows: [] }) }, "staff@example.com"), false);
});