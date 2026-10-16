import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { RolesService } from "./roles.service";

describe("RolesService", () => {
	let service: RolesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [RolesService],
		}).compile();

		service = module.get<RolesService>(RolesService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});
});

describe("RolesService protections", () => {
	let service: RolesService;
	let prisma: any;

	const withPermissions = (...pairs: string[]) =>
		pairs.map((p) => {
			const [resource, action] = p.split(":");
			return { resource, action };
		});

	beforeEach(() => {
		prisma = {
			role: {
				findUnique: jest.fn(),
				findMany: jest.fn().mockResolvedValue([]),
				delete: jest.fn().mockResolvedValue({ id: "r" }),
				update: jest.fn().mockResolvedValue({ id: "r" }),
				create: jest.fn().mockResolvedValue({ id: "r" }),
			},
			user: { count: jest.fn().mockResolvedValue(0) },
		};
		service = new RolesService();
		// @ts-expect-error prisma es privado; se reemplaza por un mock
		service["prisma"] = prisma;
	});

	describe("deleteRole", () => {
		it("refuses to delete the admin role", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "admin" });
			await expect(service.deleteRole("r")).rejects.toThrow(ForbiddenException);
			expect(prisma.role.delete).not.toHaveBeenCalled();
		});

		it("refuses to delete a role that still has users", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "webteam" });
			prisma.user.count.mockResolvedValue(3);
			await expect(service.deleteRole("r")).rejects.toThrow(ConflictException);
			expect(prisma.role.delete).not.toHaveBeenCalled();
		});

		it("deletes an unused custom role", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "webteam" });
			await service.deleteRole("r");
			expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: "r" } });
		});

		it.each(["webmaster", "profesor", "estudiante"])(
			"refuses to delete the %s role",
			async (name) => {
				prisma.role.findUnique.mockResolvedValue({ id: "r", name });
				await expect(service.deleteRole("r")).rejects.toThrow(ForbiddenException);
				expect(prisma.role.delete).not.toHaveBeenCalled();
			},
		);

		it("reports a role that does not exist", async () => {
			prisma.role.findUnique.mockResolvedValue(null);
			await expect(service.deleteRole("nope")).rejects.toThrow(NotFoundException);
		});
	});

	describe("updateRole", () => {
		it("rejects a body without a permissions array instead of wiping the role", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "webteam" });
			await expect(service.updateRole("r", { name: "webteam" })).rejects.toThrow(
				BadRequestException,
			);
			expect(prisma.role.update).not.toHaveBeenCalled();
		});

		it("refuses to rename the admin role", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "admin" });
			await expect(
				service.updateRole("r", {
					name: "root",
					permissions: withPermissions("user:write", "config:write"),
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("refuses to strip user:write or config:write from the admin role", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "admin" });
			await expect(
				service.updateRole("r", {
					name: "admin",
					permissions: withPermissions("app:write", "config:write"),
				}),
			).rejects.toThrow(ForbiddenException);
			await expect(
				service.updateRole("r", {
					name: "admin",
					permissions: withPermissions("user:write"),
				}),
			).rejects.toThrow(ForbiddenException);
			expect(prisma.role.update).not.toHaveBeenCalled();
		});

		it("lets the admin role change other permissions while keeping the critical ones", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "admin" });
			await service.updateRole("r", {
				name: "admin",
				permissions: withPermissions("user:write", "config:write", "app:read"),
			});
			expect(prisma.role.update).toHaveBeenCalled();
		});

		it("updates any other (non-fixed) role freely, including renaming it", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "webteam" });
			await service.updateRole("r", {
				name: "web-team",
				permissions: withPermissions("app:read"),
			});
			expect(prisma.role.update).toHaveBeenCalled();
		});

		it.each(["webmaster", "profesor", "estudiante"])(
			"refuses to rename the %s role",
			async (name) => {
				prisma.role.findUnique.mockResolvedValue({ id: "r", name });
				await expect(
					service.updateRole("r", {
						name: "otro-nombre",
						permissions: withPermissions("app:read"),
					}),
				).rejects.toThrow(ForbiddenException);
				expect(prisma.role.update).not.toHaveBeenCalled();
			},
		);

		it("refuses to scope the admin role to a team", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "admin" });
			await expect(
				service.updateRole("r", {
					name: "admin",
					scopeToOwnTeam: true,
					permissions: withPermissions("user:write", "config:write"),
				}),
			).rejects.toThrow(ForbiddenException);
			expect(prisma.role.update).not.toHaveBeenCalled();
		});
	});

	describe("scopeToOwnTeam", () => {
		it("createRole always refuses: the app only supports its four fixed roles", async () => {
			await expect(
				service.createRole({
					name: "cualquier-rol-nuevo",
					scopeToOwnTeam: true,
					permissions: withPermissions("user:write"),
				}),
			).rejects.toThrow(ForbiddenException);
			expect(prisma.role.create).not.toHaveBeenCalled();
		});

		it("updateRole saves scopeToOwnTeam on a non-admin role", async () => {
			prisma.role.findUnique.mockResolvedValue({ id: "r", name: "profesor" });
			await service.updateRole("r", {
				name: "profesor",
				scopeToOwnTeam: true,
				permissions: withPermissions("user:write"),
			});
			expect(prisma.role.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ scopeToOwnTeam: true }),
				}),
			);
		});

		it("getPermissions returns the scopeToOwnTeam flag and priority alongside permissions", async () => {
			prisma.role.findUnique.mockResolvedValue({
				scopeToOwnTeam: true,
				priority: 50,
				permissions: [{ id: "p1", resource: "user", action: "write" }],
			});
			const result = await service.getPermissions("r");
			expect(result).toEqual({
				permissions: [{ id: "p1", resource: "user", action: "write" }],
				scopeToOwnTeam: true,
				priority: 50,
			});
		});

		it("getPermissions defaults to not scoped and priority 0 for a missing role", async () => {
			prisma.role.findUnique.mockResolvedValue(null);
			const result = await service.getPermissions("missing");
			expect(result).toEqual({
				permissions: [],
				scopeToOwnTeam: false,
				priority: 0,
			});
		});

		it("findAll returns every role when the caller is not scoped", async () => {
			await service.findAll(false);
			expect(prisma.role.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: undefined }),
			);
		});

		it("findAll only shows scoped roles at or below the caller priority when scoped", async () => {
			await service.findAll(true, 50);
			expect(prisma.role.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { scopeToOwnTeam: true, priority: { lte: 50 } },
				}),
			);
		});

		it("refuses to lower the admin role priority", async () => {
			prisma.role.findUnique.mockResolvedValue({
				id: "r",
				name: "admin",
				priority: 100,
			});
			await expect(
				service.updateRole("r", {
					name: "admin",
					priority: 50,
					permissions: withPermissions("user:write", "config:write"),
				}),
			).rejects.toThrow(ForbiddenException);
			expect(prisma.role.update).not.toHaveBeenCalled();
		});
	});
});
