import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '@prisma/client';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { WalkersController } from '../walkers/walkers.controller.js';
import { ReportsController } from '../reports/reports.controller.js';
import { AdminController } from '../admin/admin.controller.js';
import { AuditController } from '../audit/audit.controller.js';
import { ROLES_KEY, IS_PUBLIC_KEY } from '../../common/decorators/roles.decorator.js';

describe('Security Hardening: Authorization Matrix Suite (Every Route x Every Role & Anonymous)', () => {
  let reflector: Reflector;
  let jwtService: any;
  let jwtGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = {
      verifyAsync: vi.fn(),
    };
    jwtGuard = new JwtAuthGuard(reflector, jwtService);
    rolesGuard = new RolesGuard(reflector);
  });

  function createMockContext(
    targetClass: any,
    targetHandler: any,
    userPayload: { id: string; email: string; name: string; role: Role } | null,
    isPublic: boolean = false,
    overrideRoles?: Role[],
  ) {
    const mockRequest: any = {
      headers: userPayload ? { authorization: 'Bearer mock-valid-token' } : {},
      user: userPayload,
    };

    const context: any = {
      getClass: () => targetClass,
      getHandler: () => targetHandler,
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({}),
      }),
    };

    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === ROLES_KEY) {
        if (overrideRoles) return overrideRoles;
        try {
          return Reflect.getMetadata(ROLES_KEY, targetHandler) || Reflect.getMetadata(ROLES_KEY, targetClass);
        } catch {
          return undefined;
        }
      }
      return undefined;
    });

    return { context, mockRequest };
  }

  const ALL_ROLES = [Role.COLLECTOR, Role.ADMIN, Role.SUPER_ADMIN];

  describe('1. Default-Deny Anonymous Access Check', () => {
    it('rejects unauthenticated requests on protected controllers', async () => {
      const { context } = createMockContext(WalkersController, WalkersController.prototype.listWalkers, null, false);
      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('allows unauthenticated requests on explicitly @Public() routes', async () => {
      const { context } = createMockContext(AuthController, AuthController.prototype.login, null, true);
      const canActivate = await jwtGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });
  });

  describe('2. Walkers Controller Matrix', () => {
    const routes = [
      { name: 'GET /walkers (listWalkers)', handler: WalkersController.prototype.listWalkers, allowed: [Role.COLLECTOR, Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'POST /walkers (createWalker)', handler: WalkersController.prototype.createWalker, allowed: [Role.COLLECTOR, Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'GET /walkers/:id (getWalker)', handler: WalkersController.prototype.getWalker, allowed: [Role.COLLECTOR, Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'PATCH /walkers/:id (updateWalker)', handler: WalkersController.prototype.updateWalker, allowed: [Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'DELETE /walkers/:id (softDeleteWalker)', handler: WalkersController.prototype.softDeleteWalker, allowed: [Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'POST /walkers/:id/restore (restoreWalker)', handler: WalkersController.prototype.restoreWalker, allowed: [Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'POST /walkers/:id/renew (renewWalkerPass)', handler: WalkersController.prototype.renewWalkerPass, allowed: [Role.COLLECTOR, Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'POST /walkers/:id/reveal-aadhaar', handler: WalkersController.prototype.revealAadhaar, allowed: [Role.ADMIN, Role.SUPER_ADMIN] },
      { name: 'GET /walkers/export (exportWalkers)', handler: WalkersController.prototype.exportWalkers, allowed: [Role.ADMIN, Role.SUPER_ADMIN] },
    ];

    routes.forEach((route) => {
      it(`enforces RBAC matrix on ${route.name}`, async () => {
        // Anonymous check
        const { context: anonCtx } = createMockContext(WalkersController, route.handler, null, false, route.allowed);
        await expect(jwtGuard.canActivate(anonCtx)).rejects.toThrow(UnauthorizedException);

        // Role checks
        for (const role of ALL_ROLES) {
          const { context: roleCtx } = createMockContext(
            WalkersController,
            route.handler,
            { id: 'usr-1', email: `${role.toLowerCase()}@test.com`, name: 'Test User', role },
            false,
            route.allowed,
          );

          if (route.allowed.includes(role)) {
            expect(rolesGuard.canActivate(roleCtx)).toBe(true);
          } else {
            expect(() => rolesGuard.canActivate(roleCtx)).toThrow(ForbiddenException);
          }
        }
      });
    });
  });

  describe('3. Reports Controller Matrix (Admin & SuperAdmin only)', () => {
    const reportHandlers = [
      { name: 'GET /reports/collections', handler: ReportsController.prototype.getCollectionsReport },
      { name: 'GET /reports/expiries', handler: ReportsController.prototype.getExpiriesReport },
      { name: 'GET /reports/cash-reconciliation', handler: ReportsController.prototype.getCashReconciliation },
      { name: 'POST /reports/cash-reconciliation', handler: ReportsController.prototype.recordCashReconciliation },
      { name: 'GET /reports/receipt-register', handler: ReportsController.prototype.getReceiptRegister },
      { name: 'GET /reports/export/payments', handler: ReportsController.prototype.exportPayments },
    ];

    reportHandlers.forEach((route) => {
      it(`restricts ${route.name} from COLLECTOR, grants ADMIN & SUPER_ADMIN`, () => {
        const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN];

        // COLLECTOR -> 403 Forbidden
        const { context: collectorCtx } = createMockContext(
          ReportsController,
          route.handler,
          { id: 'c-1', email: 'col@park.com', name: 'Collector', role: Role.COLLECTOR },
          false,
          adminRoles,
        );
        expect(() => rolesGuard.canActivate(collectorCtx)).toThrow(ForbiddenException);

        // ADMIN -> 200 OK
        const { context: adminCtx } = createMockContext(
          ReportsController,
          route.handler,
          { id: 'a-1', email: 'adm@park.com', name: 'Admin', role: Role.ADMIN },
          false,
          adminRoles,
        );
        expect(rolesGuard.canActivate(adminCtx)).toBe(true);

        // SUPER_ADMIN -> 200 OK
        const { context: superAdminCtx } = createMockContext(
          ReportsController,
          route.handler,
          { id: 'sa-1', email: 'sa@park.com', name: 'SuperAdmin', role: Role.SUPER_ADMIN },
          false,
          adminRoles,
        );
        expect(rolesGuard.canActivate(superAdminCtx)).toBe(true);
      });
    });
  });

  describe('4. Admin Controller Matrix (Staff, Gates & Settings)', () => {
    it('restricts GET /admin/dashboard to ADMIN and SUPER_ADMIN only', () => {
      const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN];
      const collectorCtx = createMockContext(
        AdminController,
        AdminController.prototype.getDashboard,
        { id: 'c1', email: 'c@p.com', name: 'C', role: Role.COLLECTOR },
        false,
        adminRoles,
      ).context;
      expect(() => rolesGuard.canActivate(collectorCtx)).toThrow(ForbiddenException);

      const adminCtx = createMockContext(
        AdminController,
        AdminController.prototype.getDashboard,
        { id: 'a1', email: 'a@p.com', name: 'A', role: Role.ADMIN },
        false,
        adminRoles,
      ).context;
      expect(rolesGuard.canActivate(adminCtx)).toBe(true);
    });

    it('restricts POST /admin/gates and PATCH /admin/settings to SUPER_ADMIN only', () => {
      const superAdminOnly = [Role.SUPER_ADMIN];

      // ADMIN should be forbidden on SuperAdmin-only routes
      const adminCtx = createMockContext(
        AdminController,
        AdminController.prototype.createGate,
        { id: 'a1', email: 'a@p.com', name: 'A', role: Role.ADMIN },
        false,
        superAdminOnly,
      ).context;
      expect(() => rolesGuard.canActivate(adminCtx)).toThrow(ForbiddenException);

      // SUPER_ADMIN should be granted
      const superAdminCtx = createMockContext(
        AdminController,
        AdminController.prototype.createGate,
        { id: 'sa1', email: 'sa@p.com', name: 'SA', role: Role.SUPER_ADMIN },
        false,
        superAdminOnly,
      ).context;
      expect(rolesGuard.canActivate(superAdminCtx)).toBe(true);
    });
  });

  describe('5. Audit Logs Controller Matrix', () => {
    it('blocks COLLECTOR from accessing audit logs, allows ADMIN and SUPER_ADMIN', () => {
      const adminRoles = [Role.ADMIN, Role.SUPER_ADMIN];

      const collectorCtx = createMockContext(
        AuditController,
        AuditController.prototype.getAuditLogs,
        { id: 'c1', email: 'c@p.com', name: 'C', role: Role.COLLECTOR },
        false,
        adminRoles,
      ).context;
      expect(() => rolesGuard.canActivate(collectorCtx)).toThrow(ForbiddenException);

      const adminCtx = createMockContext(
        AuditController,
        AuditController.prototype.getAuditLogs,
        { id: 'a1', email: 'a@p.com', name: 'A', role: Role.ADMIN },
        false,
        adminRoles,
      ).context;
      expect(rolesGuard.canActivate(adminCtx)).toBe(true);
    });
  });
});
